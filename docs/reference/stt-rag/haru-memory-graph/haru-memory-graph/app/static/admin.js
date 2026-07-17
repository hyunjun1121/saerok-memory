const user = 'USR-000001';

async function loadTimeline() {
  const rows = await fetch(`/api/users/${user}/timeline`).then(r => r.json());
  document.getElementById('timeline').innerHTML = rows.map(r => `
    <article class="timeline-item">
      <strong>${r.date}</strong>
      <p>${r.transcript}</p>
      <div>${r.entities.map(e => `<span class="tag">${e.type}: ${e.value}</span>`).join('')}</div>
      <small>신뢰도 ${r.confidence}${r.sensitive ? ' · 민감 기록' : ''}</small>
    </article>
  `).join('');
}

document.getElementById('ask').onclick = async () => {
  const question = document.getElementById('question').value;
  const result = await fetch(`/api/users/${user}/qa`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({question, top_k:8})
  }).then(r => r.json());
  document.getElementById('answer').textContent = JSON.stringify(result, null, 2);
};

document.getElementById('generate').onclick = async () => {
  const target_date = document.getElementById('targetDate').value;
  const result = await fetch(`/api/users/${user}/questions/generate`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({target_date, count:4})
  }).then(r => r.json());
  document.getElementById('questions').textContent = JSON.stringify(result, null, 2);
};

loadTimeline();
