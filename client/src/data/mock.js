// FICTIONAL UI DEMO DATA. No persistence/authentication or real claiming.
import { reactive, computed } from 'vue'
export const currentUser = { id: 'u1', name: 'Alex Tan', initials: 'AT' }
export const families = [
 {id:'f1',name:'The Tan Family',inviteCode:'TAN-2026',members:[{id:'u1',name:'Alex Tan',role:'Organiser'},{id:'u2',name:'Mei Tan',role:'Member'},{id:'u3',name:'Daniel Tan',role:'Member'},{id:'u4',name:'Auntie Lina',role:'Member'}]},
 {id:'f2',name:'The Lim Family',inviteCode:'LIM-2026',members:[{id:'u1',name:'Alex Tan',role:'Member'},{id:'u5',name:'Rachel Lim',role:'Organiser'},{id:'u6',name:'Uncle Ben',role:'Member'}]}
]
export const demoState = reactive({ activeFamilyId: 'f1', tasks: [] })
export const activeFamily = computed(()=>families.find(f=>f.id===demoState.activeFamilyId) || families[0])
export const family = families[0] // legacy export; new pages should use activeFamily.
export const recipients = [
 {id:'grandpa',familyId:'f1',name:'Grandpa Tan',initials:'GT',relationship:'Grandfather',age:78,condition:'Mobility support',status:'Ongoing care',allergies:'Penicillin',mobility:'Uses walking stick',notes:'Prefers morning appointments',contact:'Mei Tan',color:'#e6f2e9'},
 {id:'mum',familyId:'f1',name:'Mum',initials:'MT',relationship:'Mother',age:51,condition:'Post-surgery recovery',status:'Temporary care',allergies:'None recorded',mobility:'Avoid heavy lifting',notes:'Follow-up scheduled next week',contact:'Alex Tan',color:'#fff0df'},
 {id:'baby',familyId:'f1',name:'Baby Ellie',initials:'BE',relationship:'Niece',age:1,condition:'Daily care',status:'Ongoing care',allergies:'Eggs (under review)',mobility:'Not applicable',notes:'Nap around 1 PM',contact:'Daniel Tan',color:'#e8ebff'},
 {id:'grandma-lim',familyId:'f2',name:'Grandma Lim',initials:'GL',relationship:'Family friend',age:81,condition:'Transport and mobility support',status:'Ongoing care',allergies:'None recorded',mobility:'Needs support on stairs',notes:'Uses wheelchair for long trips',contact:'Rachel Lim',color:'#e6f2e9'},
 {id:'uncle-lim',familyId:'f2',name:'Uncle Lim',initials:'UL',relationship:'Uncle',age:64,condition:'Recovery support',status:'Temporary care',allergies:'None recorded',mobility:'Short walks only',notes:'Needs groceries every Sunday',contact:'Rachel Lim',color:'#fff0df'}
]
export const tasks = [
 {id:'t1',familyId:'f1',recipientId:'grandpa',title:'Cardiology follow-up',type:'Medical appointment',date:'2026-10-12',time:'09:30',location:'Singapore General Hospital',status:'Claimed',assignee:'Alex Tan',details:'Bring appointment card and medication list',journey:true},
 {id:'t2',familyId:'f1',recipientId:'grandpa',title:'Weekly groceries',type:'Errand',date:'2026-10-10',time:'16:00',location:'NTUC FairPrice',status:'Available',assignee:null,details:'Oats, milk, bananas and low-sodium soup',journey:false},
 {id:'t3',familyId:'f1',recipientId:'mum',title:'Physiotherapy visit',type:'Appointment',date:'2026-10-14',time:'14:00',location:'Community clinic',status:'Claimed',assignee:'Mei Tan',details:'Bring recovery plan from discharge',journey:true},
 {id:'t4',familyId:'f1',recipientId:'baby',title:'Babysitting shift',type:'Childcare',date:'2026-10-11',time:'13:00',location:'Home',status:'Available',assignee:null,details:'Help during afternoon nap window',journey:false},
 {id:'t5',familyId:'f1',recipientId:'grandpa',title:'Refill prescription',type:'Medication',date:'2026-10-07',time:'11:00',location:'Pharmacy',status:'Completed',assignee:'Alex Tan',details:'Prescription successfully collected',journey:false},
 {id:'t6',familyId:'f2',recipientId:'grandma-lim',title:'Escort to specialist clinic',type:'Appointment',date:'2026-10-15',time:'10:00',location:'Polyclinic',status:'Available',assignee:null,details:'Wheelchair and appointment documents',journey:true},
 {id:'t7',familyId:'f2',recipientId:'uncle-lim',title:'Sunday grocery pickup',type:'Errand',date:'2026-10-11',time:'10:30',location:'Nearby supermarket',status:'Available',assignee:null,details:'Collect fruits and food staples',journey:false},
 {id:'t8',familyId:'f2',recipientId:'grandma-lim',title:'Pick up medication',type:'Medication',date:'2026-10-13',time:'15:00',location:'Pharmacy',status:'Claimed',assignee:'Alex Tan',details:'Collect medicine before closing',journey:false}
]
export const careLogs=[
 {id:'l1',recipientId:'grandpa',date:'2026-10-07',author:'Alex Tan',category:'Medication',title:'Prescription collected',text:'Collected routine refill.'},
 {id:'l2',recipientId:'grandpa',date:'2026-10-04',author:'Mei Tan',category:'Consultation',title:'Clinic follow-up notes',text:'Monitor mobility changes.'},
 {id:'l3',recipientId:'mum',date:'2026-10-06',author:'Mei Tan',category:'Recovery',title:'Recovery check-in',text:'Doing well with short walks.'},
 {id:'l4',recipientId:'baby',date:'2026-10-03',author:'Daniel Tan',category:'Daily care',title:'Feeding notes',text:'Tracking food sensitivities.'},
 {id:'l5',recipientId:'grandma-lim',date:'2026-10-05',author:'Rachel Lim',category:'Transport',title:'Wheelchair note',text:'Bring chair for longer journeys.'}
]
export const milestones=[{title:'Departed home',time:'9:00 AM',done:true},{title:'Arrived at clinic',time:'9:22 AM',done:true},{title:'Appointment finished',time:'Pending',done:false},{title:'Heading home',time:'Pending',done:false}]
export const selectedRecipients = computed(()=>recipients.filter(r=>r.familyId===demoState.activeFamilyId))
export const selectedTasks = computed(()=>tasks.filter(t=>t.familyId===demoState.activeFamilyId))
export const openTasks = computed(()=>selectedTasks.value.filter(t=>t.status==='Available'&&!t.assignee))
export const recipientById = id => recipients.find(r=>r.id===id)
export const taskById = id => tasks.find(t=>t.id===id)
export const selectFamily = id => {if(families.some(f=>f.id===id)) demoState.activeFamilyId=id}
