/**
 * fix_club_phones.js
 * Applies phone number corrections gathered from club websites.
 * Run: node scripts/fix_club_phones.js
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => l.split('=').map(s => s.trim()))
);

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

// Confirmed correct from websites
const UPDATES = [
  { id: '58940e0d-a9ce-4068-a28c-ec716b6bff2c', phone: '(410) 612-1000' },  // Chesapeake FSC
  { id: 'd7de5be5-2f79-4d40-8444-5acb81821e6f', phone: '(480) 585-7465' },  // Coyotes Ice FSC
];

// Clearly invalid numbers: wrong digit count, non-existent area codes, or confirmed wrong site
const NULL_IDS = [
  '3a73366d-47f3-47f5-8721-ec22866ddf12',  // Broadmoor SC - "43995451" (8 digits)
  'd35d3575-2573-4e25-8a0a-e1c1fb62d7a4',  // Florida Everblades FSC - "+552132532112630" (too long)
  '21e9ae08-0cda-4a2d-a00e-faff6cc2e49c',  // Arizona SC - "320547581" (9 digits)
  '568ca0e1-67dc-4f24-acb3-05cab8357306',  // SC of Boston - "467627310" (9 digits)
  '22e2d863-6c5d-4e95-a5aa-11bf6ec03694',  // Wasatch FSC - "844034390" (9 digits)
  '6449b5c6-067f-4e8f-a46a-07be774bd65e',  // Pavilion SC of Cleveland Heights - "6637647" (7 digits)
  '57063561-ddf3-45fa-800f-a41815ef1951',  // SC of San Francisco - "(183) area code invalid"
  '547e11ed-28d1-4c40-b93d-8d8fd89964fe',  // San Francisco SC - "(183) area code invalid"
  'f1c12400-0127-4b36-9580-5b5b5f947bd7',  // Skyline SC - "+1800759222624" (too long)
  'fa9b0b2e-ff57-4d08-b331-4a1267459724',  // Fort Wayne FSC - "1032081" (7 digits)
  '3361a18d-76d7-4917-8267-52861f231221',  // Lehigh Valley FSC - confirmed belongs to LVEDC not FSC
  '7974cda0-314d-4c9d-82e4-9e157f7895dc',  // Twin Rinks Ice Pavilion - "+84782174652" (Vietnamese prefix)
  '2f87f78a-633d-479a-9f21-681172616e18',  // Ice Diamond FSC - "+71997292844" (Russian prefix)
  'd6963beb-a2e0-4b2e-a5fb-4ac0e6c368af',  // Baltimore FSC - "212396003" (9 digits)
  '43403cb4-5bfb-458a-8983-7845c9e0b0fc',  // Penn State FSC - "4957498" (7 digits)
  '49a38cf5-f8f4-4577-8525-44a990bd8371',  // Connecticut SC - "2000887" (7 digits)
  '8b669e4f-f971-42bc-8e13-05f6ef83ccf3',  // Bay Area FSC - "33333333" (obviously fake)
  'f8906c08-74fe-4d59-8f03-e9b16d9ae639',  // Toronto Cricket SC - "017905369" (9 digits, domain parked)
  '13796473-4feb-44d2-b26a-845b222767a3',  // SC of Greenwich - "5262488" (7 digits)
  'c939931e-1a2e-4b48-8292-2e089e316566',  // New Haven FSC - "065161916" (9 digits)
  'a4e54206-fe95-4d67-8056-82e2c16635ca',  // Des Moines FSC - "37953587" (8 digits)
  'a87bf67f-27c5-46d8-ace3-861c05214f7b',  // Cape Cod FSC - "2884575" (7 digits)
  'c8f50464-c512-4ead-9663-4892d29ce9d6',  // SC of Houston - "770705671" (9 digits)
  '65ac3902-87a9-4f2a-817e-da4aba6cad4f',  // Madison SC - "5216607" (7 digits)
  '9aa86a48-90f8-4bde-a207-58475fa79224',  // Peninsula SC - "(247) area code invalid"
  '95ce4668-a1b9-42dd-b3c5-882970bf90fe',  // Wichita FSC - "44786252" (8 digits)
  'e7b36d52-b96c-4f7f-bc8d-fc4f20e61bcd',  // Long Island SA - confirmed belongs to Long Island Soccer Club
  '462dcaf9-9a8f-4824-add4-c5a910bbc558',  // Illinois Valley FSC - confirmed belongs to Illinois Valley Design
  '69152576-81ff-47de-89fa-0402f6d50002',  // FSC of Minneapolis - "+360111364770" (too long)
  'a36c6b93-af43-4af5-a239-9abb31da6cbb',  // SC of Victoria - "+314192535267336" (too long)
  '4a2f8586-e2d8-4ff0-b581-7b455ba7806d',  // North Coast FSC - "(950) area code does not exist"
  '8dd3a126-53cf-410b-a1ef-5f3ccbb5e34d',  // Phoenix FSC - "+1 (592) area code does not exist"
  'a4affc64-fe54-4466-a834-4fe54a74083c',  // Minnesota SC - "(336) is NC area code, not MN"
];

async function run() {
  let changed = 0;
  let nulled = 0;

  for (const { id, phone } of UPDATES) {
    const { error } = await supabase.from('clubs').update({ phone }).eq('id', id);
    if (error) { console.error(`  UPDATE failed for ${id}:`, error.message); }
    else { console.log(`  SET ${id} → ${phone}`); changed++; }
  }

  for (const id of NULL_IDS) {
    const { error } = await supabase.from('clubs').update({ phone: null }).eq('id', id);
    if (error) { console.error(`  NULL failed for ${id}:`, error.message); }
    else { console.log(`  CLEARED ${id}`); nulled++; }
  }

  console.log(`\nDone. ${changed} updated, ${nulled} cleared.`);
}

run();
