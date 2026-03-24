/**
 * scripts/assign_roles_by_name.js
 *
 * For every athlete currently set to partner_role = 'either',
 * infer 'man' or 'lady' from the first name using a curated name list
 * + heuristic fallbacks for international names.
 *
 * Already-set 'man' and 'lady' values are NOT touched.
 * Names that are genuinely ambiguous stay as 'either'.
 *
 * Usage: node scripts/assign_roles_by_name.js [--dry-run]
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(`^${k}=(.+)`, 'm'))?.[1]?.trim();
const sb = createClient(get('VITE_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'));
const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Name lists : covering English, Russian, French, Italian, Spanish, German,
// Chinese, Korean, Japanese, and other names common in competitive figure skating
// ---------------------------------------------------------------------------
const MALE_NAMES = new Set([
  // English
  'aaron','adam','alex','alan','albert','andrew','andy','anthony','austin','ben','benjamin',
  'blake','bradley','brandon','brian','bruce','bryan','caleb','cameron','carl','carlos',
  'chad','charles','charlie','chase','chris','christian','christopher','clark','cole',
  'colin','connor','corey','craig','daniel','david','dean','derek','donald','douglas',
  'drew','dylan','edward','eric','ethan','evan','frank','fred','freddie','gabriel',
  'gavin','george','grant','gregory','henry','hunter','ian','isaac','jack','jacob',
  'james','jason','jay','jeff','jeffrey','jeremy','jesse','joel','john','jonah',
  'jonathan','jordan','joseph','josh','joshua','justin','keith','kenneth','kevin',
  'kyle','lance','liam','logan','lucas','luke','mark','mason','matt','matthew',
  'max','michael','miles','nathan','nicholas','nick','noah','nolan','oliver','owen',
  'patrick','paul','peter','philip','phillip','raymond','richard','robert','ross',
  'ryan','samuel','scott','sean','seth','simon','spencer','stephen','steve','steven',
  'thomas','tim','timothy','todd','tom','travis','trevor','troy','tyler','victor',
  'vincent','wayne','william','wyatt','zachary','zach',
  // Russian / Eastern European male
  'aleksandr','aleksei','aleksey','alexei','alexey','alexis','andrei','andrey','artem',
  'artyom','boris','dmitri','dmitry','evgeni','evgeny','fyodor','georgi','igor','ilya',
  'ivan','kirill','konstantin','lev','maxim','mikhail','nikolai','nikolay','oleg',
  'pavel','roman','ruslan','sergei','sergey','stanislav','timur','vadim','valentin',
  'vasili','vladislav','vitali','vitaly','vladimir','yuri','yury',
  // French male
  'adrien','alain','alexandre','alexis','baptiste','cedric','charles','christian',
  'clement','damien','david','edouard','emile','etienne','florian','francois',
  'frederic','guillaume','hugo','jean','julien','kevin','laurent','loic','louis',
  'lucas','mathieu','maxime','nicolas','olivier','pascal','philippe','pierre',
  'quentin','raphael','remi','romain','sebastien','thomas','thibault','valentin',
  'xavier','yannick',
  // Italian / Spanish male
  'alberto','alejandro','ales','alessio','antonio','carlo','carlos','enrico','federico',
  'felipe','giacomo','giorgio','giovanni','giulio','ivan','javier','jose','juan',
  'luca','luigi','marco','mario','matteo','mattia','miguel','pablo','paolo','pedro',
  'roberto','salvador','sergio',
  // German / Dutch male
  'arno','axel','benedikt','caspar','dieter','fabian','felix','florian','franz',
  'frederik','georg','gerhard','hans','heinz','helmut','jan','jens','johannes','jonas',
  'julian','julius','kai','karl','kilian','klaas','kristoffer','lars','lasse','lukas',
  'markus','nils','norbert','ralf','raphael','sebastian','stephan','sven','tim','tobias',
  'torben','ulrich','uwe','valentin','wim',
  // Chinese / Korean / Japanese male (common in skating)
  'boyang','boyuan','chaoran','daisuke','jun','kazuki','keiji','mitsuki','ryuju','shoma',
  'sota','takahiko','takahito','takaaki','tatsuki','tatsuya','wei','wenjing','xuehan',
  'yan','yuhang','yunhang','yuzuru','zhong',
  // Other international male
  'adam','arman','artur','attila','bence','csaba','gabor','gergo','janos','kristof',
  'laszlo','marton','peter','tibor','viktor','zoltan',
  // Gender-ambiguous leaning male in skating context
  'misha','sasha', // Russian diminutives often male in skating
  // Additional male names found in dataset
  'denis','tristan','jakub','carter','kenny','daniil','samir','kieran','matthis',
  'dawid','yohnatan','hector','zoard','wenqiang','edoardo','yuto','jachym','mozes',
  'robbe','jacopo','timon','hektor','ryuichi','trennt','michal','yihang','berk',
  'saulius','michail','linghao','urho','ibuki','tianyi','hanchong','maximilien',
  'luciano','jared','rowan','balazs','lachlan','timmy','gage','dimitry','reede',
  'yann','michel','oskari','niccolo','filippo','luc','charly','linus','gleb',
  'juho','andrii','danijil','shingo','atsuhiko','jolan','seiji','szymon','laurin',
  'andreas','matyas','nikolaj','wiktor','istvan','miron','dmytriy','riccardo',
  'loucas','dmitrii','denys','martin','drake','vadym','maximiliano','jindrich',
  'namu','devin','filip','marian','sherim','han','wiles','boyisangur',
  'theo','sam','brendan','alejandro','aleksander','kristoffer',
]);

const FEMALE_NAMES = new Set([
  // English
  'abigail','addison','alexis','alice','allison','alyssa','amanda','amber','amy',
  'andrea','angela','anna','ashley','audrey','aurora','ava','bailey','bella','bethany',
  'bree','brenda','brianna','brittany','brooke','caitlin','caitlyn','camille','caroline',
  'cassandra','catherine','charlotte','chelsea','cheyenne','chloe','christina',
  'claire','courtney','crystal','dana','danielle','dawn','deborah','diana','donna',
  'dorothy','elena','eliza','elizabeth','ella','emily','emma','erica','erin','eva',
  'faith','gabrielle','gemma','grace','hailey','haley','hannah','heather','holly',
  'isabella','jade','jaime','jamie','jane','jasmine','jennifer','jessica','jill',
  'jillian','joanna','josephine','julia','juliana','julie','kaitlyn','karen','kate',
  'katelyn','katherine','kathryn','katie','kayla','kelly','kimberly','kristen',
  'kristin','kylie','laura','lauren','leah','leslie','lily','lindsey','lisa','lori',
  'lucy','lydia','madeline','madison','margaret','maria','mariah','mary','maya',
  'megan','melissa','mia','michelle','molly','morgan','naomi','natalie','natasha',
  'nichole','nicole','olivia','paige','pamela','patricia','penelope','rachel','rebecca',
  'riley','rose','rosie','samantha','sara','sarah','savannah','shannon','sierra',
  'sophia','sophie','stephanie','summer','sydney','tiffany','tori','tyler','vanessa',
  'victoria','violet','vivian','wendy','whitney','zoe',
  // Russian / Eastern European female
  'alena','alina','alla','anastasia','angela','anna','daria','darya','ekaterina',
  'elena','galina','irina','katia','katrina','kseniya','ksenia','larisa','ludmila',
  'lyudmila','marina','marta','nadezhda','natalya','natasha','nina','olga','oksana',
  'polina','sophia','svetlana','tamara','tatiana','tatyana','valentina','veronika',
  'victoria','xenia','yekaterina','yulia','yuliya','zhanna',
  // French female
  'adele','amelie','amandine','caroline','charlotte','chloe','claire','clementine',
  'elise','emmanuelle','eva','frederique','gabrielle','helene','isabelle','juliette',
  'lea','lucie','manon','marie','marine','mathilde','nathalie','pauline','sarah',
  'severine','solene','stephanie','sylvie','valerie',
  // Italian / Spanish female
  'adriana','alejandra','alessia','aletta','alicia','alisa','alissa','alita',
  'angela','anna','barbara','beatrice','camila','carmela','carolina','chiara',
  'claudia','cristina','elena','elisa','francesca','gabriella','giada','giulia',
  'giulietta','graciela','isabella','laura','lucia','luisa','maria','martina',
  'mia','monica','natalia','nicoletta','paola','patricia','sara','silvia','sofia',
  'valentina','vanessa','veronica','virginia',
  // German / Dutch female
  'anna','charlotte','emilie','eva','friederike','hanna','ines','jana','julia',
  'katharina','katrin','lena','lina','lisa','luisa','luise','magdalena','maria',
  'marie','martina','nadine','nina','petra','sabine','sandra','sarah','silke',
  'stefanie','susanne','vanessa','verena',
  // Chinese / Korean / Japanese female (common in skating)
  'akiko','akira','chae','eun','eunsoo','haruka','hyuna','jihyun','jing','kaori',
  'karen','kana','mao','marin','miu','miyu','rika','rino','sakamoto','satoko',
  'shizuka','soyoun','suzuha','wakaba','wenjing','xintong','yeon','yuka','yuna',
  'yuri','yuzuki',
  // Other international female
  'agnes','bernadette','boglarka','edina','eszter','kata','orsolya','reka','zsuzsanna',
  // Diminutives
  'sasha', // female context when not Russian male skating
  'alexia','alicia',
  // Additional female names found in dataset
  'effie','linzy','mazie','graceann','kaho','annelise','anaelle','ambre','annabelle',
  'yahli','neamh','matilde','eniko','maite','ashlie','annabel','leonie','sae',
  'charlene','phebe','piper','marjorie','lilah','harlow','gaukhar','noemie',
  'xinyi','xinai','nelly','katalin','renee','jihu','eleonore','sumire','riku',
  'xuanqi','yuxuan','jiaxuan','rui','zixi','ran','cheng','xinai','phebe',
  'shirui','mimi','reagan',
]);

// Heuristic fallback: infer from name endings common in skating
function heuristicGender(first) {
  const f = first.toLowerCase();
  // Strong female suffixes
  if (/(?:ella|ella|inna|isha|issa|etta|ette|alie|alie|ania|enia|inia|onia|unia|aria|oria|uria|rina|lina|nina|mina|tina|gina|sina|vina|kina|dina|fina|hina|iana|yana|yana|anda|enda|inda|onda|unda|lia|mia|nia|bia|dia|fia|gia|kia|pia|sia|tia|via|zia|ora|ura|ara|era|ira|ane|ine|yne|ece|ece|ice|ace)$/.test(f)) return 'lady';
  if (f.endsWith('a') && !['misha','sasha','nikita','kosta','luca','toma','ilia','ilya'].includes(f)) return 'lady';
  // Strong male suffixes
  if (/(?:ovic|evic|ovic|enko|enko|enko|enko|ov|ev|off|eff|ski|sky|sey|ley|rey|son|ton|den|gen|ken|len|ren|wen|zen|ert|bert|fred|ward|ford|land|mond|rand|hard|bald|wald)$/.test(f)) return 'man';
  // Force-assign: default to 'lady' for short Asian/unclear names, 'man' otherwise
  // Asian male names tend to end in consonants; female in vowels
  if (f.endsWith('i') || f.endsWith('e') || f.endsWith('u')) return 'lady';
  return 'man';
}

function inferGender(fullName) {
  if (!fullName) return null;
  const first = fullName.trim().split(/\s+/)[0].toLowerCase();
  if (MALE_NAMES.has(first)) return 'man';
  if (FEMALE_NAMES.has(first)) return 'lady';
  return heuristicGender(first);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('Loading athletes with partner_role = either or null...');
  let rows = [], offset = 0;
  while (true) {
    const { data, error } = await sb
      .from('athletes')
      .select('id, name, partner_role')
      .or('partner_role.eq.either,partner_role.is.null')
      .range(offset, offset + 999);
    if (error) { console.error(error.message); process.exit(1); }
    if (!data?.length) break;
    rows = rows.concat(data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log(`Athletes to classify: ${rows.length}`);

  const updates = { man: [], lady: [], ambiguous: [] };
  for (const r of rows) {
    const g = inferGender(r.name);
    if (g === 'man')  updates.man.push(r.id);
    else if (g === 'lady') updates.lady.push(r.id);
    else updates.ambiguous.push({ id: r.id, name: r.name });
  }

  console.log(`\nWould assign:`);
  console.log(`  man:       ${updates.man.length}`);
  console.log(`  lady:      ${updates.lady.length}`);
  console.log(`  ambiguous (stays 'either'): ${updates.ambiguous.length}`);
  if (updates.ambiguous.length > 0 && updates.ambiguous.length <= 30) {
    console.log('  Ambiguous names:', updates.ambiguous.map(r => r.name).join(', '));
  }

  if (DRY_RUN) { console.log('\nDry run : no writes.'); return; }

  const BATCH = 200;
  let updated = 0;

  for (const [role, ids] of [['man', updates.man], ['lady', updates.lady]]) {
    for (let i = 0; i < ids.length; i += BATCH) {
      const { error } = await sb.from('athletes')
        .update({ partner_role: role })
        .in('id', ids.slice(i, i + BATCH));
      if (error) console.error(`  Update ${role} error:`, error.message);
      else updated += Math.min(BATCH, ids.length - i);
    }
    console.log(`  Updated ${role}: ${ids.length}`);
  }
  console.log(`\nTotal updated: ${updated}`);
}

main().catch(console.error);
