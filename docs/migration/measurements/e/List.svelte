<script>
  let rows = $state([]);
  window.__render = (n) => new Promise((res) => {
    const t0 = performance.now();
    rows = Array.from({ length: n }, (_, i) => ({ id: i, name: 'Order ' + i, qty: i % 17, total: (i * 3.7).toFixed(2) }));
    requestAnimationFrame(() => setTimeout(() => res(performance.now() - t0)));
  });
  window.__update = () => new Promise((res) => {
    const t0 = performance.now();
    for (let i = 0; i < rows.length; i += 10) rows[i].qty++;
    requestAnimationFrame(() => setTimeout(() => res(performance.now() - t0)));
  });
</script>
<table><tbody>{#each rows as r (r.id)}<tr><td>{r.id}</td><td>{r.name}</td><td>{r.qty}</td><td>{r.total}</td></tr>{/each}</tbody></table>
