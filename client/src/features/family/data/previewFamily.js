// Fictional fixtures are used ONLY by the explicit /preview routes.
import { reactive, watch } from 'vue'

const STORAGE_KEY = 'carecircle:family-preview:v1'
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Singapore',
}).format(new Date())
const at = (time) => new Date(`${today}T${time}:00+08:00`).toISOString()
export const previewUser = {
  id: 'alex',
  name: 'Alex Tan',
  email: 'alex@carecircle.test',
  preferredLang: 'en',
  avatar: '👦',
}

function initialState() {
  const members = [
    {
      user: { _id: 'alex', ...previewUser },
      role: 'admin',
      relationship: 'Grandson',
    },
    {
      user: {
        _id: 'jasmine',
        name: 'Jasmine',
        email: 'jasmine@carecircle.test',
        preferredLang: 'en',
        avatar: '👩🏻',
      },
      role: 'admin',
      relationship: 'Granddaughter',
    },
    {
      user: {
        _id: 'may',
        name: 'Aunt May',
        email: 'may@carecircle.test',
        preferredLang: 'zh',
        avatar: '👩🏻‍🦳',
      },
      role: 'member',
      relationship: 'Daughter',
    },
    {
      user: {
        _id: 'mia',
        name: 'Mia',
        email: 'mia@carecircle.test',
        preferredLang: 'en',
        avatar: '👧🏻',
      },
      role: 'member',
      relationship: 'Granddaughter',
    },
  ]
  const recipients = [
    {
      _id: 'grandpa',
      nickname: 'Grandpa',
      name: 'Tan Ah Kow',
      careType: 'elderly',
      mobility: 'assisted mobility',
      avatar: '👴🏻',
    },
    {
      _id: 'grandma',
      nickname: 'Grandma',
      name: 'Tan Mei Lin',
      careType: 'elderly',
      careNotes: 'knee physio',
      avatar: '👵🏻',
    },
    {
      _id: 'emma',
      nickname: 'Baby Emma',
      name: 'Emma Tan',
      careType: 'infant',
      careNotes: '4 months',
      avatar: '👶🏻',
    },
  ]
  return {
    family: { id: 'preview-tan', name: 'Tan family', inviteCode: 'TAN123' },
    members,
    recipients,
    tasks: [
      {
        _id: 'eye',
        title: 'Eye check-up',
        startAt: at('10:00'),
        location: { name: 'TTSH Eye Centre' },
        recipient: recipients[0],
        claimedBy: members[1].user,
        status: 'in_progress',
        needsTransit: true,
      },
      {
        _id: 'formula',
        title: 'Buy formula and diapers',
        startAt: at('14:00'),
        location: { name: 'FairPrice, Junction 8' },
        recipient: recipients[2],
        claimedBy: null,
        status: 'open',
      },
      {
        _id: 'walk',
        title: 'Evening walk',
        startAt: at('18:00'),
        location: { name: 'around the block' },
        recipient: recipients[1],
        claimedBy: members[2].user,
        status: 'claimed',
      },
      {
        _id: 'review',
        title: 'Diabetes review',
        startAt: new Date(
          new Date(at('09:00')).getTime() + 86400000,
        ).toISOString(),
        location: { name: 'Polyclinic' },
        recipient: recipients[0],
        claimedBy: null,
        status: 'open',
      },
      {
        _id: 'physio',
        title: 'Physio session',
        startAt: new Date(
          new Date(at('09:30')).getTime() + 86400000,
        ).toISOString(),
        recipient: recipients[1],
        status: 'open',
        claimedBy: null,
      },
    ],
    transit: {
      recipient: recipients[0],
      companion: members[1].user,
      headline: 'Grandpa arrived at TTSH Eye Centre with Jasmine',
      detail: '10:12am · 2 of 5 milestones · next: consultation done',
      taskId: 'eye',
    },
    updates: [
      {
        _id: 'u1',
        avatar: '👩🏻',
        text: 'Jasmine marked “Arrived at clinic” for Grandpa',
        time: '10:12am',
      },
      {
        _id: 'u2',
        avatar: '👩🏻',
        text: 'Jasmine posted a new task: formula and diapers',
        time: '8:15am',
      },
      {
        _id: 'u3',
        avatar: '👩🏻‍🦳',
        text: 'Aunt May updated Grandma’s medication',
        time: 'Yesterday, 8:40pm',
      },
      {
        _id: 'u4',
        avatar: '👦',
        text: 'Alex completed the weekly grocery run',
        time: 'Yesterday, 12:20pm',
      },
    ],
  }
}

let saved
try {
  saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
} catch {
  /* Use fresh fixtures. */
}
const valid =
  saved?.family?.id === 'preview-tan' &&
  ['members', 'recipients', 'tasks', 'updates'].every((key) =>
    Array.isArray(saved[key]),
  )
export const previewState = reactive(valid ? saved : initialState())
watch(
  previewState,
  (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      /* Preview still works without storage. */
    }
  },
  { deep: true },
)

export function resetPreview() {
  Object.assign(previewState, initialState())
}
