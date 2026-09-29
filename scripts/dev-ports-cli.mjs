// dev-ports-cli.mjs - "npm run ports"
// Nagpapakita kung sinong process ang may hawak ng bawat GFC port.
import { describeAllPorts, formatBlockers, GFC_PORTS } from './dev-ports.mjs';

const states = await describeAllPorts();

console.log('');
console.log('GFC fixed ports');
console.log('----------------');
for (const s of states) {
  const status = s.free ? 'FREE' : `BUSY  ${s.process}${s.pid ? ` (pid ${s.pid})` : ''}`;
  console.log(`  ${String(s.port).padEnd(6)} ${s.label.padEnd(24)} ${status}`);
}

const busy = states.filter(s => !s.free);
if (busy.length) {
  console.log('');
  console.log('Detalye:');
  console.log(formatBlockers(busy));
  console.log('');
  console.log(`Fixed na ito: ${GFC_PORTS.site} = website, ${GFC_PORTS.admin} = admin, ${GFC_PORTS.backend} = API + upload.`);
  console.log('Hindi pinapatay ng GFC ang ibang process - isara mo ang gumagamit ng port.');
} else {
  console.log('');
  console.log('Libreng lahat. Puwedeng patakbuhin: npm run dev');
}
console.log('');
