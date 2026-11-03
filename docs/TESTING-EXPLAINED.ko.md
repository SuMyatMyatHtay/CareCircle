# CareCircle 테스트 설명과 main 점검

2026-11-02에 GitHub `origin/main`을 fetch해서 로컬 main과 같은
`2081b4d`임을 확인하고 테스트를 점검했다. 아래 내용은 그 main 위에 추가한
테스트까지 포함한다. 테스트 개수는 코드 커버리지 백분율을 뜻하지 않는다.

합산 runner 도입 전 검증 기록: Node 회귀 148개, 테스트 도구 2개, Vitest 180개,
API suite 50개, desktop/mobile E2E 62개, **합계 442개 통과**.
각 레이어와 production build를 실행해 확인했다.

## 1. Unit / component testing: 한 단위의 입력과 출력

순수 함수 테스트는 함수에 정해진 입력을 주고 반환값을 확인한다.
예를 들어 dashboard의 날짜 함수가 UTC가 아닌 싱가포르 자정 기준으로
task를 묶는지 검증한다.

```js
import { describe, it, expect } from 'vitest'
import { singaporeDay } from '../composables/useFamilyDashboard.js'

describe('Singapore dates used by the family dashboard', () => {
  it('uses the Singapore date across UTC midnight boundaries', () => {
    expect(singaporeDay('2026-10-20T16:00:00Z')).toBe('2026-10-21')
  })
})
```

실제 실행 파일: [singapore-dates.spec.js](../client/src/features/family/__tests__/singapore-dates.spec.js).

컴포넌트 테스트에서는 `mount()`로 실제 Vue 컴포넌트를 렌더링한다.
`props`는 부모가 주는 입력이고, `emitted()`는 자식이 부모에게 보낸 이벤트를
관찰하는 API다. 클릭을 실제로 발생시킨 뒤 화면과 이벤트를 확인한다.

아래는 새로 추가한 실행 파일에서 핵심만 발췌한 예시다.

```js
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MobileInviteCodeCard from '../components/MobileInviteCodeCard.vue'

describe('Mobile invite code component contract', () => {
  it('renders the code prop and emits regenerate once', async () => {
    const wrapper = mount(MobileInviteCodeCard, {
      props: { code: 'AABBCCDDEE', familyName: 'Tan family', isAdmin: true },
    })
    expect(wrapper.text()).toContain('AABBCCDDEE')
    await wrapper.get('button[aria-label="Regenerate invite code"]').trigger('click')
    expect(wrapper.emitted('regenerate')).toEqual([[]])
  })
})
```

실행 파일: [MobileInviteCodeCard.spec.js](../client/src/features/settings/__tests__/MobileInviteCodeCard.spec.js).
추가로 일반 멤버·저장 중의 재발급 금지, 최신 props로 공유, 공유 중 중복 클릭,
공유 취소, 실패 후 재시도, clipboard 대체, preview 격리를 검증한다.
네이티브 공유 창 자체는 jsdom에서 실행할 수 없어 `navigator.share`와
clipboard만 `vi.fn()`으로 대체한다.

기존 [FamilyMembersCard.spec.js](../client/src/features/settings/__tests__/FamilyMembersCard.spec.js)는
`change-role`의 멤버와 역할 payload, 마지막 admin 보호, 바깥 클릭·Escape를
검증한다. 새 [TaskPermissionsCard.spec.js](../client/src/features/settings/__tests__/TaskPermissionsCard.spec.js)는
삭제 권한의 기본값, 저장 중 상태, 실패 복구, 일반 멤버 차단, 늦은 가족 응답을 검증한다.

## 2. Integration testing: 실제 부품 사이의 연결

새 Telegram integration 테스트의 실행 경로는 다음과 같다.

`TelegramSettingsCard → NotificationToggle의 change emit → useTelegramSettings → notificationsApi → http.patch`

카드, 자식 스위치, composable, API adapter는 실제 코드를 사용한다.
이 레이어에서는 HTTP 전송만 대체해서 지연·실패를 재현한다.

아래는 [TelegramSettings.integration.spec.js](../client/src/features/settings/__tests__/TelegramSettings.integration.spec.js)의
저장 시나리오 발췌다. `render()`는 해당 파일의 실제 컴포넌트 mount helper다.

```js
it('saves the whole event group through a real child switch', async () => {
  const save = vi.spyOn(http, 'patch').mockResolvedValue({
    data: { notifyOn: ['task.created', 'task.updated', 'task.deleted'] },
  })
  const wrapper = await render()
  await wrapper.get('input[aria-label="A task is posted"]').setValue(true)
  await flushPromises()

  expect(save).toHaveBeenCalledWith('/families/one/notify-settings', {
    notifyOn: ['task.created', 'task.updated', 'task.deleted'],
  }, expect.any(Object))
  expect(wrapper.get('[role="status"]').text()).toBe('Telegram preferences saved.')
})
```

테스트를 먼저 실행했을 때 세 케이스가 실패했다. 서버에서 읽은 설정 대신
`preferences`의 preview 값을 자식 스위치에 넘기고 있었기 때문이다.
`TelegramSettingsCard.vue`의 `:checked`를 `isOn(option.key)`로 연결해
서버 값, 저장 중 선택, 실패 시 rollback이 화면에 반영되게 수정했다.

기존 page integration도 유지한다.

- [FamilySettings.integration.spec.js](../client/src/features/settings/__tests__/FamilySettings.integration.spec.js): 실제 page·panels·router·adapters 사이에서 언어 저장 중 roster 유지, 실패 복구, Home까지 theme 전달.
- [FamilyHome.integration.spec.js](../client/src/features/family/__tests__/FamilyHome.integration.spec.js): task 필터, claim 후 cache 반영, 이동 후 복귀, overdue 선택.
- 수신자, care logs, transit, 반복 task에도 기존 component integration 테스트가 있다.

서버 통합은 별도 레이어다.
[family-api.test.mjs](../tests/integration/family-api.test.mjs) 등의 테스트는
실제 Express route, JWT middleware, Mongoose, 임시 로컬 MongoDB를 함께 실행한다.
두 사람이 동시에 claim할 때 한 명만 성공하는지, 가족 격리, 마지막 admin 보호,
초대코드 교체 후 가입, 저장과 로그아웃 token 폐기를 검증한다.
이 기존 서버 suite는 **Node test runner**를 사용한다. Vitest로 전부
전환했다고 주장하지 않는다.

## 3. E2E testing: 브라우저에서 사용자의 여정 전체

Playwright가 Vue 앱과 실제 Express API, 임시 MongoDB를 시작하고,
사용자처럼 입력·클릭·탐색·새로고침한다. 같은 시나리오를 desktop Chromium과
390px mobile Chromium에서 실행한다.

예를 들어 기존 [family-workflows.spec.mjs](../tests/e2e/family-workflows.spec.mjs)는
로그인 실패/성공, 로그아웃과 보호 페이지, 언어 저장, 전체 다크 모드,
수신자 CRUD, task 생성·claim, 가족 전환, 역할과 초대코드를 검증한다.

새 [onboarding-workflows.spec.mjs](../tests/e2e/onboarding-workflows.spec.mjs)는
회원가입 검증·중복 이메일과 **가입 → 가족 생성 → 초대코드 발급 → 다른
계정으로 가입 → Member 권한 확인 → 새로고침**을 검증한다.
아래는 실제 흐름의 일부다. `family.inviteCode`는 생성 API의 실제 응답이다.

```js
await page.goto('/join-family')
await page.getByLabel("What's your family invitation code?", { exact: true })
  .fill(family.inviteCode.toLowerCase())
await page.getByRole('button', { name: 'Join my family', exact: false }).click()
await expect(page.getByRole('heading', {
  name: 'Welcome to the family! ♡', exact: true,
})).toBeVisible()
```

새 [notification-settings.spec.mjs](../tests/e2e/notification-settings.spec.mjs)는
알림·reminder 저장 후 새로고침, 가족별 격리, 일반 멤버 UI 차단과 직접
API 요청의 403을 확인한다. 실제 Telegram 메시지는 전송하지 않는다.

새 [overdue-deletion.spec.mjs](../tests/e2e/overdue-deletion.spec.mjs)는 기본
멤버 삭제 금지, admin이 허용한 뒤 멤버 삭제, 확인창 취소, 선택한 한 항목만
삭제, 선택하지 않은 overdue·미래 task 보존과 재조회 결과를 확인한다.

E2E의 `test`와 `expect`는 **Playwright** API다. Vitest의 같은 이름과
역할은 비슷하지만 runner가 다르다. 기존 Node suite와 Playwright를 유지하고,
새 Vue 테스트는 요청한 Vitest 형식을 사용했다.

## 테스트 문법 설명

| API | 용도 | 이 프로젝트의 예 |
| --- | --- | --- |
| `describe()` | 관련 케이스를 한 suite로 묶음 | Mobile invite code component contract |
| `it()` / `test()` | 개별 케이스 정의; Vitest에서는 서로 alias | 재발급 클릭 시 이벤트 1회 |
| `test.each()` | 같은 규칙을 여러 입력으로 검증 | 일반 멤버 / 저장 중 admin |
| `expect()` | 실제 결과와 기대값 비교 | `toBe`, `toEqual`, `toHaveBeenCalledWith` |
| `vi.fn()` / `vi.spyOn()` | 외부 API를 제어하고 호출 관찰 | clipboard·HTTP 지연/실패 |
| `props` / `setProps()` | 컴포넌트 입력과 부모의 변경 | 가족과 초대코드 변경 |
| `trigger()` / `setValue()` | DOM 사용자 동작 | 클릭, checkbox 변경 |
| `emitted()` | 부모에게 전달한 이벤트·payload 검증 | `regenerate`, `change-role` |
| `flushPromises()` | 이미 진행 중인 Promise 처리 후 결과 확인 | 저장 응답 후 화면 확인 |

참고: [Vitest test/it](https://main.vitest.dev/api/test),
[Vue Test Utils props](https://test-utils.vuejs.org/guide/essentials/passing-data),
[Vue Test Utils events](https://test-utils.vuejs.org/guide/essentials/event-handling),
[Playwright test](https://playwright.dev/docs/api/class-test).

## 점검에서 보강한 공백

| main에서 부족했던 검증 | 이번 보강 |
| --- | --- |
| 모바일 초대코드 공유의 취소·실패·fallback | Vitest 11 cases |
| Telegram 서버 설정과 실제 스위치 연결 | Vitest 8 cases, 발견한 표시 버그 수정 |
| 새 overdue 삭제 권한 카드의 저장·복구 | Vitest 5 cases |
| 회원가입·가족 생성·초대코드 가입 여정 | E2E 2 scenarios × 2 viewports |
| 알림·reminder persistence와 권한 | E2E 1 scenario × 2 viewports |
| overdue 실제 선택 삭제와 권한 설정 | E2E 1 scenario × 2 viewports |

추가 합계는 **Vitest 24 cases + E2E 8 executions**다.

기존 suite도 현재 main에 맞게 복구했다. 최근 추가된
`unclaimedReminderAt` 기록을 unit test의 in-memory model에 반영해 실제 DB
호출로 빠지는 7건의 타임아웃을 해결했다. API claim·소유권 테스트는
공통 fixture의 고정 오후 2시 대신 현재 기준 미래 task로 검증한다.
live trip E2E의 setup도 claim 가능한 미래 시간으로 바꿨고, 모바일 반복 task는
desktop 전용 heading 대신 Tasks 패널의 실제 6개 session을 확인한다.
거절 응답·권한·동시 claim의 기대값은 유지했다.

남은 공백도 있다. Assistant의 제안→확인 전체 브라우저 여정, search UI,
avatar/pet 편집과 contributions 전체 여정은 아직 별도 E2E가 없다.
각 기능의 기존 unit/API/component 테스트가 전혀 없다는 의미는 아니다.
Firefox/WebKit, 부하 테스트, 배포 환경 검증과 GitHub Actions 자동 실행도
이번 범위에 포함하지 않았다. 실제 Telegram 전송, Gemini/Groq/Azure 품질,
Google 동의 화면, GPS/OneMap 같은 외부 서비스는 로컬 double 또는 미설정
상태로 검증하므로 실서비스 성공을 보장하는 테스트는 아니다.

## 실행

```sh
# Vue Vitest: unit/component 및 frontend integration
npm run test:client

# 기존 Node unit/regression, 격리 helper, Vitest
npm test

# 실제 API/임시 MongoDB
npm run test:api

# 실제 브라우저 두 화면 크기
npm run test:e2e

# 모든 레이어와 별도 production build
npm run test:all
npm run build
```

`npm run test:all`은 이제 모든 suite 실행 뒤 **CareCircle Test Summary** 표와
현재 실행의 `N checks passed.` 합계를 터미널에 출력한다. 위의 442는 이전
검증 기록이며 고정 출력값이 아니다. 새 테스트와 합산 도구 자체의 검증도
현재 개수에 반영된다.

각 suite의 실패·skip을 구분하고, 실패해도 나머지 suite를 실행한다.
실패하거나 결과 파일이 없으면 종료 코드는 0이 아니며, 누락된 결과를
성공으로 계산하지 않는다. Ctrl+C로 중단하면 나머지 suite는 시작하지 않는다.
원본 결과와 합산 JSON은 출력된 `.test-runtime/test-all-*` 폴더에 저장된다.

DB는 테스트가 새로 생성한 `127.0.0.1`의 `carecircle_test_*`만 사용한다.
팀의 Atlas DB나 `server/seed.js`는 사용하지 않는다. 실행 상세와 기존
설정은 [TESTING.md](TESTING.md), [TESTING-RECURRING.md](TESTING-RECURRING.md)를 참고한다.
