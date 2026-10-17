/**
 * CareCircle — seed script
 * Fills your MongoDB database with linked sample data based on the
 * "CareCircle database design" doc (the Tan family).
 *
 * Usage (from the server/ folder):
 *   npm install mongodb bcryptjs dotenv
 *   node seed.js
 *
 * Reads MONGODB_URI from server/.env. The database name in that URI
 * (e.g. .../carecircle_marcus?...) is the database that gets seeded.
 *
 * WARNING: it CLEARS the CareCircle collections in that database first,
 * so you can re-run it any time to reset to a clean state.
 *
 * Every sample user's password is: password123
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('MONGODB_URI is missing. Add it to server/.env first.');
  process.exit(1);
}

// Collection names match Mongoose's defaults for the model names
// User, Family, CareRecipient, Task, LogEntry, TransitSession, Notification,
// so your Mongoose models will read this data with no extra config.
const C = {
  users: 'users',
  families: 'families',
  recipients: 'carerecipients',
  tasks: 'tasks',
  logs: 'logentries',
  transit: 'transitsessions',
  notifications: 'notifications',
};

// ---------- date helpers (Singapore time, relative to today) ----------
// Dates are relative to the day you run the script, so "today's tasks"
// on the Home screen always have something to show.
const nowSgt = new Date(Date.now() + 8 * 3600 * 1000);
const Y = nowSgt.getUTCFullYear(), M = nowSgt.getUTCMonth(), D = nowSgt.getUTCDate();
/** at(dayOffset, hour, minute) -> Date at that Singapore local time */
const at = (off, h, min = 0) => new Date(Date.UTC(Y, M, D + off, h - 8, min));

// ---------- fixed ids so documents can reference each other ----------
const id = () => new ObjectId();
const U = { alex: id(), jasmine: id(), may: id(), mia: id() };
const FAMILY = id();
const R = { grandpa: id(), grandma: id(), emma: id() };
const T = {
  eyeCheck: id(), formula: id(), walk: id(), physio: id(), diabetes: id(),
  vaccination: id(), refill: id(), babysit: id(), groceries: id(),
  pastConsult: id(), dental: id(),
};
const S = { eyeCheck: id(), pastConsult: id() };

// ---------- reusable locations (OneMap shape) ----------
const LOC = {
  ttsh: { name: 'TTSH Eye Centre', address: '11 Jalan Tan Tock Seng', postal: '308433', lat: 1.3214, lng: 103.8458 },
  amkPoly: { name: 'Ang Mo Kio Polyclinic', address: '21 Ang Mo Kio Central 2', postal: '569666', lat: 1.3746, lng: 103.8457 },
  kkh: { name: "KK Women's and Children's Hospital", address: '100 Bukit Timah Road', postal: '229899', lat: 1.3105, lng: 103.8466 },
  bishanCC: { name: 'Bishan Community Club', address: '51 Bishan Street 13', postal: '579799', lat: 1.3510, lng: 103.8500 },
  junction8: { name: 'FairPrice, Junction 8', address: '9 Bishan Place', postal: '579837', lat: 1.3507, lng: 103.8488 },
  guardian: { name: 'Guardian Pharmacy, Bishan', address: '9 Bishan Place', postal: '579837', lat: 1.3507, lng: 103.8488 },
  home: { name: 'Home', address: 'Bishan Street 22', postal: '570000', lat: 1.3590, lng: 103.8460 },
};

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(); // the database named in the URI
  const dbName = db.databaseName;

  if (['admin', 'local', 'config', 'test'].includes(dbName)) {
    console.error(
      `Refusing to seed "${dbName}". Put your own database name in MONGODB_URI, ` +
      'e.g. ...mongodb.net/carecircle_marcus?retryWrites=true&w=majority'
    );
    await client.close();
    process.exit(1);
  }

  console.log(`Seeding database "${dbName}"...`);

  // ---------- clear old data ----------
  for (const name of Object.values(C)) {
    await db.collection(name).drop().catch(() => {}); // ignore "ns not found"
  }

  const passwordHash = await bcrypt.hash('password123', 10);
  const created = at(-30, 9);

  // ---------- users ----------
  const users = [
    { _id: U.alex, name: 'Alex Tan', email: 'alex@carecircle.test', preferredLang: 'en', telegramUsername: 'alextan', phone: '+65 9000 0001' },
    { _id: U.jasmine, name: 'Jasmine Tan', email: 'jasmine@carecircle.test', preferredLang: 'en', telegramUsername: 'jasminetan', phone: '+65 9000 0002' },
    { _id: U.may, name: 'Aunt May', email: 'may@carecircle.test', preferredLang: 'zh', telegramUsername: 'auntmay', phone: '+65 9000 0003' },
    { _id: U.mia, name: 'Mia Tan', email: 'mia@carecircle.test', preferredLang: 'en', telegramUsername: 'miatan', phone: '+65 9000 0004' },
  ].map((u) => ({ ...u, passwordHash, createdAt: created, updatedAt: created }));

  // ---------- families (members embedded) ----------
  const families = [{
    _id: FAMILY,
    name: 'Tan family',
    inviteCode: '7925C4A333',
    createdBy: U.alex,
    members: [
      { userId: U.alex, role: 'admin', relationship: 'Grandson', joinedAt: created },
      { userId: U.jasmine, role: 'admin', relationship: 'Granddaughter', joinedAt: at(-29, 20) },
      { userId: U.may, role: 'member', relationship: 'Daughter', joinedAt: at(-28, 19) },
      { userId: U.mia, role: 'member', relationship: 'Granddaughter', joinedAt: at(-27, 18) },
    ],
    // Placeholder: replaced for real when the bot receives /link 7925C4A333
    telegram: { chatId: '-1000000000000', linkedBy: U.alex, linkedAt: at(-27, 21) },
    notifyOn: [
      'task.created', 'task.claimed', 'task.unclaimed', 'task.completed',
      'task.cancelled', 'transit.milestone', 'log.created', 'medication.changed',
    ],
    createdAt: created,
    updatedAt: at(-27, 21),
  }];

  // ---------- care recipients ----------
  const recipients = [
    {
      _id: R.grandpa,
      family: FAMILY,
      name: 'Tan Ah Kow',
      nickname: 'Grandpa',
      careType: 'elderly',
      dateOfBirth: new Date('1944-03-12'),
      mobility: { level: 'assisted', notes: 'Walking stick. Avoid stairs; use lifts.' },
      allergies: [{ name: 'Penicillin', severity: 'severe' }],
      conditions: ['Type 2 diabetes', 'Glaucoma'],
      dietaryRestrictions: ['Low sugar', 'Soft food'],
      medications: [
        { name: 'Metformin 500mg', dosage: '1 tablet', frequency: '2x daily, after meals', startDate: at(-400, 9), notes: '', updatedBy: U.may, updatedAt: at(-60, 20) },
        { name: 'Eye drops', dosage: '1 drop', frequency: 'Nightly, both eyes', startDate: at(-200, 9), notes: 'Keep in the fridge', updatedBy: U.may, updatedAt: at(-60, 20) },
      ],
      emergencyContacts: [
        { name: 'Aunt May', relationship: 'Daughter', phone: '+65 9000 0003' },
        { name: 'Alex Tan', relationship: 'Grandson', phone: '+65 9000 0001' },
      ],
      preferredClinic: LOC.amkPoly,
      careNotes: 'Likes a kopi-o before appointments. Gets anxious in crowds; sit near the door.',
      isActive: true,
      createdAt: created,
      updatedAt: at(-6, 13),
    },
    {
      _id: R.grandma,
      family: FAMILY,
      name: 'Lim Siew Lan',
      nickname: 'Grandma',
      careType: 'elderly',
      dateOfBirth: new Date('1947-08-30'),
      mobility: { level: 'independent', notes: 'Knee pain on long walks. Physio weekly.' },
      allergies: [{ name: 'Shellfish', severity: 'mild' }],
      conditions: ['Hypertension'],
      dietaryRestrictions: ['Low sodium'],
      medications: [
        { name: 'Amlodipine', dosage: '10mg', frequency: 'Once daily, morning', startDate: at(-300, 9), notes: 'Increased from 5mg', updatedBy: U.may, updatedAt: at(-1, 20, 40) },
      ],
      emergencyContacts: [{ name: 'Aunt May', relationship: 'Daughter', phone: '+65 9000 0003' }],
      preferredClinic: LOC.amkPoly,
      careNotes: 'Prefers Mandarin. Evening walk around the block keeps her knee loose.',
      isActive: true,
      createdAt: created,
      updatedAt: at(-1, 20, 40),
    },
    {
      _id: R.emma,
      family: FAMILY,
      name: 'Emma Tan',
      nickname: 'Baby Emma',
      careType: 'infant',
      dateOfBirth: at(-125, 0),
      mobility: { level: 'bedbound', notes: 'Infant; always supervise.' },
      allergies: [],
      conditions: [],
      dietaryRestrictions: ['Formula only'],
      medications: [],
      emergencyContacts: [{ name: 'Jasmine Tan', relationship: 'Mother', phone: '+65 9000 0002' }],
      preferredClinic: LOC.kkh,
      careNotes: 'Naps 1-3pm. Formula: 4 scoops in 120ml warm water. Fussy around 5pm; white noise helps.',
      isActive: true,
      createdAt: created,
      updatedAt: created,
    },
  ];

  // ---------- tasks (every status represented) ----------
  const task = (t) => ({
    family: FAMILY,
    description: '',
    endAt: null,
    location: null,
    needsTransit: false,
    claimedBy: null,
    claimedAt: null,
    completedAt: null,
    ...t,
    updatedAt: t.updatedAt || t.createdAt,
  });

  const tasks = [
    task({ _id: T.eyeCheck, recipient: R.grandpa, title: 'Eye check-up', category: 'appointment', description: 'Annual glaucoma review. Bring his old spectacles.', startAt: at(0, 10), endAt: at(0, 11, 30), location: LOC.ttsh, needsTransit: true, status: 'in_progress', createdBy: U.may, claimedBy: U.jasmine, claimedAt: at(-5, 21), createdAt: at(-7, 20), updatedAt: at(0, 9, 35) }),
    task({ _id: T.formula, recipient: R.emma, title: 'Buy formula and diapers', category: 'groceries', description: 'Size 3 diapers, the blue formula tin.', startAt: at(0, 14), location: LOC.junction8, status: 'open', createdBy: U.jasmine, createdAt: at(0, 8, 15) }),
    task({ _id: T.walk, recipient: R.grandma, title: 'Evening walk', category: 'companionship', startAt: at(0, 18), endAt: at(0, 18, 45), location: LOC.home, status: 'claimed', createdBy: U.may, claimedBy: U.may, claimedAt: at(-1, 21), createdAt: at(-1, 20, 50) }),
    task({ _id: T.physio, recipient: R.grandma, title: 'Physio session', category: 'therapy', description: 'Knee physio. She needs a ride there and back.', startAt: at(1, 9, 30), endAt: at(1, 10, 30), location: LOC.bishanCC, needsTransit: true, status: 'open', createdBy: U.may, createdAt: at(-3, 19) }),
    task({ _id: T.diabetes, recipient: R.grandpa, title: 'Diabetes review', category: 'appointment', description: 'Two-week follow-up requested by Dr Tan.', startAt: at(6, 14, 30), endAt: at(6, 15, 30), location: LOC.amkPoly, needsTransit: true, status: 'open', createdBy: U.may, createdAt: at(-6, 14) }),
    task({ _id: T.vaccination, recipient: R.emma, title: 'Vaccination appointment', category: 'appointment', startAt: at(12, 10), endAt: at(12, 11), location: LOC.kkh, needsTransit: true, status: 'claimed', createdBy: U.jasmine, claimedBy: U.jasmine, claimedAt: at(-2, 22), createdAt: at(-2, 22) }),
    task({ _id: T.refill, recipient: R.grandpa, title: 'Pick up medication refill', category: 'errand', description: 'Metformin and eye drops. Prescription is in the red folder.', startAt: at(2, 12), location: LOC.guardian, status: 'claimed', createdBy: U.may, claimedBy: U.alex, claimedAt: at(-1, 13), createdAt: at(-2, 9) }),
    task({ _id: T.babysit, recipient: R.emma, title: 'Babysit Emma', category: 'childcare', description: 'Jasmine has a dinner. Bedtime 8pm.', startAt: at(2, 19), endAt: at(2, 22), location: LOC.home, status: 'claimed', createdBy: U.jasmine, claimedBy: U.mia, claimedAt: at(-1, 17), createdAt: at(-1, 16) }),
    task({ _id: T.groceries, recipient: null, title: 'Weekly grocery run', category: 'groceries', description: 'Household list on the fridge.', startAt: at(-1, 11), location: LOC.junction8, status: 'completed', createdBy: U.may, claimedBy: U.alex, claimedAt: at(-3, 10), completedAt: at(-1, 12, 20), createdAt: at(-4, 19), updatedAt: at(-1, 12, 20) }),
    task({ _id: T.pastConsult, recipient: R.grandpa, title: 'Polyclinic consultation', category: 'appointment', startAt: at(-6, 10), endAt: at(-6, 11), location: LOC.amkPoly, needsTransit: true, status: 'completed', createdBy: U.alex, claimedBy: U.may, claimedAt: at(-9, 20), completedAt: at(-6, 12, 5), createdAt: at(-10, 18), updatedAt: at(-6, 12, 5) }),
    task({ _id: T.dental, recipient: R.grandma, title: 'Dental cleaning', category: 'appointment', startAt: at(3, 15), location: LOC.amkPoly, status: 'cancelled', createdBy: U.may, createdAt: at(-5, 20), updatedAt: at(-2, 9) }),
  ];

  // ---------- log entries ----------
  const log = (l) => ({
    family: FAMILY, task: null, originalLang: 'en', translations: {},
    consultation: null, medicationChanges: [], inputMethod: 'text',
    ...l, updatedAt: l.createdAt,
  });

  const logs = [
    log({
      recipient: R.grandpa, task: T.pastConsult, author: U.may, type: 'consultation',
      content: 'Blood sugar stable. Doctor wants a review in two weeks and less rice at dinner.',
      translations: { zh: '血糖稳定。医生希望两周后复诊，晚餐少吃米饭。' },
      consultation: { doctorName: 'Dr Tan Wei Ming', clinic: 'Ang Mo Kio Polyclinic', nextAppointment: at(6, 14, 30) },
      createdAt: at(-6, 11, 20),
    }),
    log({
      recipient: R.grandma, author: U.may, type: 'medication_change',
      content: 'Amlodipine increased to 10mg every morning. BP was 150/95 at the GP.',
      medicationChanges: [{ name: 'Amlodipine', change: 'dosage_changed', details: '5mg to 10mg, once daily' }],
      originalLang: 'en', createdAt: at(-1, 20, 40),
    }),
    log({
      recipient: R.grandpa, author: U.jasmine, type: 'symptom',
      content: 'Grandpa says his left eye is blurry in the mornings. Raise this at the eye check-up.',
      inputMethod: 'voice', createdAt: at(-2, 21, 10),
    }),
    log({
      recipient: R.emma, author: U.jasmine, type: 'general',
      content: 'Slept 2.5 hours after the lunch feed. Fussy from 5pm; white noise helped.',
      createdAt: at(-1, 18, 30),
    }),
    log({
      recipient: R.grandpa, task: T.groceries, author: U.alex, type: 'diet',
      content: 'Bought the low-sugar biscuits and oats he likes. No more kaya bread in the cupboard.',
      createdAt: at(-1, 12, 30),
    }),
  ];

  // ---------- transit sessions ----------
  const transit = [
    {
      _id: S.eyeCheck, family: FAMILY, task: T.eyeCheck, companion: U.jasmine, status: 'active',
      milestones: [
        { type: 'departed', label: 'Departed home', at: at(0, 9, 35), lat: LOC.home.lat, lng: LOC.home.lng },
        { type: 'arrived', label: 'Arrived at clinic', at: at(0, 10, 12), lat: LOC.ttsh.lat, lng: LOC.ttsh.lng },
      ],
      lastLocation: { lat: LOC.ttsh.lat, lng: LOC.ttsh.lng, at: at(0, 10, 12) },
      startedAt: at(0, 9, 35), endedAt: null,
      createdAt: at(0, 9, 35), updatedAt: at(0, 10, 12),
    },
    {
      _id: S.pastConsult, family: FAMILY, task: T.pastConsult, companion: U.may, status: 'ended',
      milestones: [
        { type: 'departed', label: 'Departed home', at: at(-6, 9, 30), lat: LOC.home.lat, lng: LOC.home.lng },
        { type: 'arrived', label: 'Arrived at clinic', at: at(-6, 9, 52), lat: LOC.amkPoly.lat, lng: LOC.amkPoly.lng },
        { type: 'consultation_done', label: 'Consultation done', at: at(-6, 11, 15), lat: LOC.amkPoly.lat, lng: LOC.amkPoly.lng },
        { type: 'heading_home', label: 'Heading home', at: at(-6, 11, 35), lat: LOC.amkPoly.lat, lng: LOC.amkPoly.lng },
        { type: 'home', label: 'Home safe', at: at(-6, 12, 5), lat: LOC.home.lat, lng: LOC.home.lng },
      ],
      lastLocation: { lat: LOC.home.lat, lng: LOC.home.lng, at: at(-6, 12, 5) },
      startedAt: at(-6, 9, 30), endedAt: at(-6, 12, 5),
      createdAt: at(-6, 9, 30), updatedAt: at(-6, 12, 5),
    },
  ];

  // ---------- notifications (Telegram outbox) ----------
  const note = (n) => ({ family: FAMILY, status: 'sent', error: null, sentAt: n.createdAt, ...n, updatedAt: n.createdAt });
  const notifications = [
    note({ eventType: 'task.created', refType: 'task', refId: T.formula, text: 'New task: Buy formula and diapers for Baby Emma, today 2:00pm. Who can take it?', createdAt: at(0, 8, 15) }),
    note({ eventType: 'transit.milestone', refType: 'task', refId: T.eyeCheck, text: 'Grandpa has departed home, with Jasmine.', createdAt: at(0, 9, 35) }),
    note({ eventType: 'transit.milestone', refType: 'task', refId: T.eyeCheck, text: 'Grandpa has arrived at TTSH Eye Centre, with Jasmine.', createdAt: at(0, 10, 12) }),
    note({ eventType: 'medication.changed', refType: 'careRecipient', refId: R.grandma, text: "Grandma's medication was updated. Check the app.", createdAt: at(-1, 20, 40) }),
    note({ eventType: 'task.claimed', refType: 'task', refId: T.walk, text: "Aunt May will take Grandma for her evening walk.", createdAt: at(-1, 21) }),
    note({ eventType: 'task.completed', refType: 'task', refId: T.groceries, text: 'Done: weekly grocery run, by Alex.', createdAt: at(-1, 12, 20) }),
    note({ eventType: 'task.cancelled', refType: 'task', refId: T.dental, text: "Cancelled: Grandma's dental cleaning.", createdAt: at(-2, 9) }),
  ];

  // ---------- insert ----------
  await db.collection(C.users).insertMany(users);
  await db.collection(C.families).insertMany(families);
  await db.collection(C.recipients).insertMany(recipients);
  await db.collection(C.tasks).insertMany(tasks);
  await db.collection(C.logs).insertMany(logs);
  await db.collection(C.transit).insertMany(transit);
  await db.collection(C.notifications).insertMany(notifications);

  // ---------- indexes (from the design doc) ----------
  await db.collection(C.users).createIndex({ email: 1 }, { unique: true });
  await db.collection(C.families).createIndex({ inviteCode: 1 }, { unique: true });
  await db.collection(C.families).createIndex({ 'members.userId': 1 });
  await db.collection(C.recipients).createIndex({ family: 1, isActive: 1 });
  await db.collection(C.tasks).createIndex({ family: 1, startAt: 1 });
  await db.collection(C.tasks).createIndex({ family: 1, status: 1 });
  await db.collection(C.tasks).createIndex({ claimedBy: 1, startAt: 1 });
  await db.collection(C.tasks).createIndex({ recipient: 1, startAt: 1 });
  await db.collection(C.logs).createIndex({ recipient: 1, createdAt: -1 });
  await db.collection(C.logs).createIndex({ family: 1, createdAt: -1 });
  await db.collection(C.transit).createIndex({ task: 1 }, { unique: true });
  await db.collection(C.transit).createIndex({ family: 1, status: 1 });
  await db.collection(C.notifications).createIndex({ family: 1, createdAt: -1 });
  await db.collection(C.notifications).createIndex({ status: 1 });

  // ---------- summary ----------
  console.log('Done. Documents per collection:');
  for (const name of Object.values(C)) {
    console.log(`  ${name.padEnd(16)} ${await db.collection(name).countDocuments()}`);
  }
  console.log('\nLog in as alex@carecircle.test / password123 (admin).');
  console.log('Other users: jasmine@, may@, mia@carecircle.test, same password.');

  await client.close();
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
