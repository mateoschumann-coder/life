import { useState } from 'react';
import { useStore } from '../lib/store';
import { today } from '../lib/dates';
import { areaStatus, pillarOf, projectProgress, upcomingBirthdays } from '../lib/logic';
import { AreaIcon, Back, Chevron, Dot, TabBar } from '../components/ui';
import { NewProjectSheet } from '../components/sheets';
import { TOOL_AREAS, toolsFor } from '../lib/tools';

export default function Saeule({ id }) {
  const s = useStore();
  const t = today();
  const [newOpen, setNewOpen] = useState(false);
  const p = pillarOf(s, id);
  if (!p) return <Missing />;
  const areas = s.areas.filter((a) => a.pillarId === id);
  const areaIds = new Set(areas.map((a) => a.id));
  const projects = s.projects.filter((x) => x.status === 'aktiv' && areaIds.has(x.areaId));

  return (
    <>
      <main className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Back href="#/bereiche" label="Bereiche" />
          <h1 className="h1">{p.name}</h1>
        </div>

        {areas.map((a) => {
          const st = areaStatus(s, a, t);
          return (
            <section key={a.id} className="list" style={{ background: `color-mix(in srgb, ${p.color} 7%, var(--card))` }}>
              <a href={`#/bereich/${a.id}`} className="row" style={{ minHeight: 60 }}>
                <AreaIcon icon={a.icon} color={p.color} size={32} />
                <span className="row-main">
                  <span className="row-title strong">{a.name}</span>
                  <span className="row-meta"><Dot small level={st.level} />{st.text}</span>
                </span>
                <Chevron />
              </a>
              <div style={{ padding: '0 16px 14px 0' }}>
                <span className="chips" style={{ paddingLeft: 44 }}>
                  {a.peopleCategory
                    ? (() => {
                      const n = s.people.filter((p) => p.category === a.peopleCategory).length;
                      const b = upcomingBirthdays(s, t, 30).filter((x) => x.person.category === a.peopleCategory).length;
                      return [<span key="n" className="tag" style={{ fontSize: 13, padding: '6px 10px' }}>{n} {n === 1 ? 'Person' : 'Personen'}</span>, b > 0 && <span key="b" className="tag" style={{ fontSize: 13, padding: '6px 10px' }}>🎂 {b} bald</span>];
                    })()
                    : TOOL_AREAS.has(a.id)
                    ? toolsFor(a.id).filter((x) => x.href).map((x) => <a key={x.title} href={x.href} className="tag" style={{ fontSize: 13, padding: '6px 10px' }}>{x.title}</a>)
                    : a.subs.map((sub) => (
                      <a key={sub.id} href={`#/unterbereich/${a.id}/${sub.id}`} className="tag" style={{ fontSize: 13, padding: '6px 10px' }}>{sub.name}</a>
                    ))}
                </span>
              </div>
            </section>
          );
        })}

        {id !== 'sozial' && (
        <section className="group">
          <div className="sec-h">
            <h2 className="h2">Aktive Projekte</h2>
            <button type="button" className="link-btn" onClick={() => setNewOpen(true)}>Neues Projekt</button>
          </div>
          {projects.length === 0 && <div className="notice">Noch keine Projekte. Ein Projekt hat ein Ende, z.B. „Marathon-Vorbereitung“ oder „Wohnung umdekorieren“.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {projects.map((x) => {
              const pr = projectProgress(s, x);
              const area = s.areas.find((a) => a.id === x.areaId);
              return (
                <a key={x.id} href={`#/projekt/${x.id}`} className="card" style={{ padding: 14, gap: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.25 }}>{x.name}</span>
                  {pr.total > 0 && <span className="progress" style={{ height: 4 }}><span style={{ width: `${pr.pct}%`, background: p.color }} /></span>}
                  <span className="tiny">{area?.name}{pr.total ? ` · ${pr.pct} %` : (x.blocks || []).length ? ` · ${x.blocks.length} Bausteine` : ''}</span>
                </a>
              );
            })}
          </div>
        </section>
        )}
      </main>
      <NewProjectSheet s={s} open={newOpen} onClose={() => setNewOpen(false)} pillarId={id} />
      <TabBar active="bereiche" />
    </>
  );
}

export function Missing() {
  return (
    <>
      <main className="screen">
        <Back href="#/heute" label="Heute" />
        <div className="notice">Diese Seite gibt es nicht (mehr).</div>
      </main>
      <TabBar />
    </>
  );
}
