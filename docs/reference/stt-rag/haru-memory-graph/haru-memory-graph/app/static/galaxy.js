const panel = document.getElementById('panel');
const userInput = document.getElementById('userId');
let Graph;

function colorFor(node) {
  if (node.sensitive) return '#f59e0b';
  if (node.id.startsWith('PROFILE')) return '#e879f9';
  const day = Number((node.date || '').split('-').pop() || 1);
  const colors = ['#22d3ee','#34d399','#a3e635','#facc15','#fb923c','#f472b6','#a78bfa'];
  return colors[(day - 1) % colors.length];
}

async function load() {
  const user = userInput.value.trim();
  const data = await fetch(`/api/users/${user}/galaxy`).then(r => r.json());
  Graph = ForceGraph3D()(document.getElementById('graph'))
    .graphData(data)
    .backgroundColor('#05070b')
    .nodeLabel(n => `${n.label}<br>${n.text || ''}`)
    .nodeColor(colorFor)
    .nodeRelSize(5)
    .linkColor(l => l.kind === 'semantic' ? 'rgba(140,180,255,.35)' : 'rgba(255,255,255,.7)')
    .linkWidth(l => l.kind === 'semantic' ? Math.max(.3, (l.score || 0) * 2) : 1.4)
    .linkDirectionalParticles(l => l.kind === 'factual' ? 2 : 0)
    .linkLabel(l => `${l.relation}${l.score ? ` ${l.score}` : ''}`)
    .onNodeClick(async node => {
      const dist = 90;
      const ratio = 1 + dist / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
      Graph.cameraPosition(
        { x:(node.x||0)*ratio, y:(node.y||0)*ratio, z:(node.z||0)*ratio },
        node, 900
      );
      const ev = await fetch(`/api/users/${user}/evidence/${node.id}`).then(r => r.ok ? r.json() : null);
      panel.innerHTML = ev ? `
        <h2>${ev.date}</h2>
        <p>${ev.transcript}</p>
        <p>신뢰도: ${ev.confidence}</p>
        <p>${ev.sensitive ? '민감 기록: 전문가 확인 필요' : '일반 기록'}</p>
        <h3>구조화 항목</h3>
        <div>${ev.entities.map(e => `<span class="tag">${e.type}: ${e.value}</span>`).join('')}</div>
        <p class="muted">Episode ID: ${ev.episode_id}</p>
      ` : `<h2>${node.label}</h2><p>${node.text || ''}</p>`;
    });

  // Preserve semantic projection as initial fixed coordinates.
  data.nodes.forEach(n => {
    if (n.fx !== null && n.fx !== undefined) {
      n.x = n.fx * 35; n.y = n.fy * 35; n.z = n.fz * 35;
    }
  });
  Graph.d3VelocityDecay(0.65);
}

document.getElementById('reload').onclick = load;
load();
