# Seunghak 파트 계획: Care Log + STT

> 패키지 F: Care Logs & Integrations
> 범위: Care log CRUD와 로그 화면, 음성 입력(STT)
> 확인 필요: Telegram, Calendar, 번역(LibreTranslate) 담당

날짜는 팀 진행 표(W8 = 10/5–11)를 기준으로 잡았다. 최종 마감은 **Week 12 금요일 오전 9시 (11/6)** 이고 연장은 없다. 중간에 방학 주가 있으면 날짜를 뒤로 민다.

## 전체 흐름

| 단계 | 기간 | 목표 | 완료 기준 |
|---|---|---|---|
| 0. 준비 | 10/13–14 | 개발 환경, 범위 확정 | 앱이 로컬에서 동작하고, 담당 범위를 팀에 확인함 |
| 1. 백엔드 | W9 (10/14–18) | 로그 CRUD API | Postman으로 5개 API가 모두 동작 |
| 2. 프론트 | W10 (10/19–25) | Care log 화면 | 화면에서 보기, 쓰기, 수정, 삭제 가능 |
| 3. STT | W11 (10/26–11/1) | 음성으로 로그 작성 | 말하면 입력칸이 채워지고 저장됨 |
| 4. 마무리 | W12 (11/2–5) | 테스트, 반응형, 문서 | E2E 통과, README 작성, 11/5(목) 코드 동결 |

---

## 0단계: 준비 (10/13–14)

- [ ] `git pull`, `feature/care-logs` 브랜치 생성
- [ ] `server/.env` 추가 (값은 팀 Env Files 문서) 후 `GET /api/health/db`에서 `connected` 확인
- [ ] 기준 코드 읽기 (Marcus의 tasks)
  - `server/src/features/tasks/TaskModel.js`: 스키마 작성 방식
  - `server/src/features/tasks/controller.js`: 검증, `{ error, errors }` 에러 형식, 가족 필터
  - `client/src/features/tasks/services/tasksApi.js`: 프론트 API 호출 방식
- [ ] 팀에 확인
  - Telegram / `notify()`, Calendar, 번역 담당이 누구인지
  - 모델 이름 통일: 파일명은 `CareLog`, 문서에는 `LogEntry`
  - Jhen의 CareRecipient 모델 일정

## 1단계: 백엔드 (W9)

라우트는 이미 `/api/families/:familyId/logs`에 `requireAuth`와 `requireFamilyMember`로 연결되어 있다.
컨트롤러에서는 `req.user.userId`, `req.family`, `req.memberRole`을 쓰면 된다.

- [ ] **상수** (`server/src/constants.js`, Marcus에게 PR)
  - `LOG_TYPES`: consultation, medication_change, diet, symptom, general
  - `INPUT_METHODS`: text, voice
  - `MEDICATION_CHANGES`: added, stopped, dosage_changed
- [ ] **모델** (`server/src/features/logs/CareLog.model.js`)
  - 필드: family, recipient, task?, author, type, content, originalLang, translations(Map), consultation { doctorName, clinic, nextAppointment }, medicationChanges [{ name, change, details }], inputMethod
  - `{ timestamps: true }`
  - 인덱스: `{ recipient: 1, createdAt: -1 }`, `{ family: 1, createdAt: -1 }`
- [ ] **API** (`controller.js`, `routes.js`)
  - [ ] `GET /`: `family: req.family._id`로 필터, `?recipient=`, `?before=`, `?limit=`(기본 20), 최신순, author 이름 populate → `{ logs }`
  - [ ] `POST /`: author는 토큰에서 가져오기(body 값은 무시), type/content 검증 → `201 { log }`
  - [ ] `GET /:logId`: 다른 가족의 로그나 잘못된 ID는 404 → `{ log }`
  - [ ] `PATCH /:logId`: 작성자 또는 admin만 허용(아니면 403), 수정 가능한 필드만 반영 → `{ log }`
  - [ ] `DELETE /:logId`: 작성자 또는 admin만 허용 → `204`
- [ ] 에러 형식은 `{ error, errors? }`로 통일
- [ ] **Postman 테스트**: 정상 / 필드 누락(400) / 다른 가족(404) / 남의 로그 수정(403) / 토큰 없음(401)
- [ ] `docs/API-CONTRACT.md` F 섹션 상태를 Implemented로 수정 (같은 PR)

## 2단계: 프론트 (W10)

- [ ] `client/src/features/logs/services/logsApi.js` (tasksApi.js 패턴)
  - `getLogs(familyId, filters)`, `createLog`, `updateLog`, `deleteLog`, `getLogErrorMessage`
- [ ] `client/src/features/logs/views/RecipientLogView.vue`
- [ ] 컴포넌트 (`features/logs/components/`)
  - `LogCard`: 타입 배지, 작성자, 날짜(싱가포르 시간으로 표시), 내용
  - `LogForm`: 타입 선택, 내용 입력. consultation이면 의사, 병원, 다음 예약 필드를 추가로 표시
- [ ] 로딩, 빈 목록, 에러 상태 처리
- [ ] 수정/삭제 버튼은 작성자나 admin에게만 표시
- [ ] 반응형: 모바일에서는 카드 한 줄, 폼은 전체 폭
- [ ] **라우터 등록** (`client/src/router/index.js`는 Sera 관리): `recipients/:recipientId/log` 주석 해제를 요청하거나 PR에 포함
- [ ] Jhen의 Recipient Hub가 생기면 Care log 탭으로 연결

## 3단계: STT (W11)

- [ ] Puter Speech-to-Text 조사: 로그인 필요 여부, 무료 사용량, 지원 브라우저
  - 채점 때 기능당 하루 5–6회 정도 테스트한다는 점을 고려 (가이드라인 FAQ 19)
- [ ] 막힐 때 쓸 대안 API 하나 정해두기
- [ ] LogForm에 🎤 버튼
  - 녹음 중 / 변환 중 상태 표시
  - 결과를 입력칸에 채우되, 사용자가 수정할 수 있게
- [ ] 저장할 때 `inputMethod: 'voice'`
- [ ] 마이크 권한 거부나 미지원 브라우저일 때 안내 문구
- [ ] (선택, 담당이 확정되면) 번역 버튼, `notify(familyId, 'log.created', ...)` 호출

## 4단계: 마무리 (W12, 11/5까지)

- [ ] **E2E 테스트** (`tests/e2e/`): 로그인 → 로그 작성 → 목록 확인 → 수정 → 삭제
  - 안정적인 선택자(`data-testid`) 사용, 반복 실행해도 통과
- [ ] **반응형 확인**: Chrome DevTools로 iPhone 6부터 Bootstrap XL까지
- [ ] **README**: 기능 설명, 테스트 실행 방법, AI 도움받은 부분 명시
- [ ] 발표용 데모 시나리오와 데모 데이터 준비

---

## 의존성

| 필요한 것 | 담당 | 없을 때 |
|---|---|---|
| CareRecipient 모델 | Jhen | recipient를 ObjectId로 저장만 하고, 소속 확인은 나중에 추가 |
| Recipient Hub 탭 | Jhen | 로그 페이지를 단독 라우트로 먼저 동작 |
| 라우터, 사이드바 | Sera | 주석 해제 PR 요청 |
| `constants.js` | Marcus | PR로 상수 추가 |
| `notify()` | 미정 | 호출 위치에 TODO만 남김 |

## 작업 규칙 (docs/OWNERSHIP.md)

- main에 직접 커밋하지 않는다. 브랜치를 만들고 PR로 올린다.
- 공용 파일(router, constants, app.js)은 담당자에게 먼저 묻는다.
- API를 바꾸면 `docs/API-CONTRACT.md`도 같은 PR에서 고친다.
- 코드는 모두 영어로 작성하되, 한글 주석은 절대 달지 않도록 한다.