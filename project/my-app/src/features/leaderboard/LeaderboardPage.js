import { useEffect, useState } from 'react';
import api from '../../config/api';
import { useAuthContext } from '../../shared/context/AuthContext';

// ─── helpers ────────────────────────────────────────────────────────────────

function medal(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
}

function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

function initials(username) {
    return (username || '?').slice(0, 2).toUpperCase();
}

// ─── sub-components ─────────────────────────────────────────────────────────

function MyRankCard({ me }) {
    if (!me) {
        return (
            <div style={s.rankCard}>
                <div style={s.rankCardTitle}>This Week's Rank</div>
                <div style={{ color: '#888', fontSize: 13, marginTop: 12 }}>
                    No has cerrado ítems esta semana aún.
                </div>
            </div>
        );
    }

    return (
        <div style={s.rankCard}>
            <div style={s.rankCardTitle}>This Week's Rank</div>
            <div style={s.bigRank}>#{me.rank}</div>
            <div style={s.bigPts}>{me.weekly_points} pts</div>
            <div style={s.rankSub}>{me.items_closed} items · {me.on_time_rate}% on time</div>
        </div>
    );
}

function PointsCard({ me }) {
    if (!me) return null;
    return (
        <div style={s.sideCard}>
            <div style={s.sideCardTitle}>Points This Week</div>
            <div style={s.pointsRow}>
                <span style={{ color: '#555' }}>Items closed</span>
                <span style={{ fontWeight: 600 }}>{me.base_points} pts</span>
            </div>
            <div style={s.pointsRow}>
                <span style={{ color: '#3C9A57' }}>On-time bonuses</span>
                <span style={{ fontWeight: 600, color: '#3C9A57' }}>+{me.bonus_points} pts</span>
            </div>
            <div style={{ ...s.pointsRow, borderTop: '1px solid #E8E8E6', paddingTop: 10, marginTop: 4 }}>
                <span style={{ fontWeight: 700 }}>Total</span>
                <span style={{ fontWeight: 700, color: '#CC0000' }}>{me.weekly_points} pts</span>
            </div>
        </div>
    );
}

function ScoringRulesCard() {
    return (
        <div style={s.sideCard}>
            <div style={s.sideCardTitle}>Scoring Rules</div>
            <ul style={s.rulesList}>
                <li>Close an item → base × weight pts</li>
                <li>On-time close → +25% bonus</li>
                <li>Leaderboard resets weekly</li>
            </ul>
            <div style={{ fontSize: 11, color: '#AAA', marginTop: 8 }}>
                * Points for completing items (RF-38/39) are assigned by the system on item closure.
            </div>
        </div>
    );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
    const { user } = useAuthContext();
    const [data, setData]     = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState(null);

    useEffect(() => {
        async function load() {
            setLoading(true);
            const { res, data: body } = await api.get('/dashboard/leaderboard');
            if (res.ok) {
                setData(body);
            } else {
                setError(body?.error || 'Error al cargar el leaderboard');
            }
            setLoading(false);
        }
        load();
    }, []);

    return (
        <div style={s.page}>
            {/* ── Top bar ── */}
            <div style={s.topBar}>
                <div style={s.breadcrumb}>
                    <span style={{ color: '#888' }}>Inicio</span>
                    <span style={{ color: '#CCC' }}>/</span>
                    <span style={{ color: '#1A1A1A', fontWeight: 500 }}>Clasificación</span>
                </div>
            </div>

            <div style={s.body}>
                <h1 style={s.pageTitle}>Leaderboard semanal</h1>
                {data && (
                    <p style={s.weekLabel}>
                        Semana {fmtDate(data.week_start)} — {fmtDate(data.week_end)}
                    </p>
                )}

                {loading && <div style={s.state}>Cargando...</div>}
                {error   && <div style={{ ...s.state, color: '#CC0000' }}>{error}</div>}

                {!loading && !error && data && (
                    <div style={s.layout}>
                        {/* ── Tabla principal ── */}
                        <div style={s.tableWrap}>
                            {data.ranking.length === 0 ? (
                                <div style={s.empty}>
                                    No hay miembros en tus proyectos aún.
                                </div>
                            ) : (
                                <table style={s.table}>
                                    <thead>
                                        <tr>
                                            <th style={{ ...s.th, width: 56 }}>#</th>
                                            <th style={{ ...s.th, textAlign: 'left' }}>Miembro</th>
                                            <th style={s.th}>Puntos</th>
                                            <th style={s.th}>Ítems cerrados</th>
                                            <th style={s.th}>% a tiempo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.ranking.map(row => {
                                            const isMe = row.id_user === user?.id;
                                            return (
                                                <tr
                                                    key={row.id_user}
                                                    style={isMe ? s.trMe : s.tr}
                                                >
                                                    <td style={s.tdRank}>
                                                        {medal(row.rank)
                                                            ? <span>{medal(row.rank)}</span>
                                                            : <span style={s.rankNum}>{row.rank}</span>
                                                        }
                                                    </td>
                                                    <td style={s.td}>
                                                        <div style={s.memberCell}>
                                                            <div style={{
                                                                ...s.avatar,
                                                                backgroundColor: isMe ? '#CC0000' : '#1A1A1A',
                                                            }}>
                                                                {initials(row.username)}
                                                            </div>
                                                            <div>
                                                                <div style={s.username}>
                                                                    {row.username}
                                                                    {isMe && <span style={s.youBadge}>Tú</span>}
                                                                </div>
                                                                {row.full_name && (
                                                                    <div style={s.fullName}>{row.full_name}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ ...s.td, ...s.tdNum, color: '#CC0000', fontWeight: 700 }}>
                                                        {row.weekly_points}
                                                    </td>
                                                    <td style={{ ...s.td, ...s.tdNum }}>
                                                        {row.items_closed}
                                                    </td>
                                                    <td style={{ ...s.td, ...s.tdNum }}>
                                                        <span style={{
                                                            color: row.on_time_rate >= 80 ? '#3C9A57'
                                                                 : row.on_time_rate >= 50 ? '#E08F00'
                                                                 : '#B94A48',
                                                            fontWeight: 600,
                                                        }}>
                                                            {row.on_time_rate}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* ── Panel derecho ── */}
                        <div style={s.sidebar}>
                            <MyRankCard me={data.my_position} />
                            <PointsCard me={data.my_position} />
                            <ScoringRulesCard />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const s = {
    page:       { minHeight: '100vh', backgroundColor: '#F5F5F4', fontFamily: "'DM Sans', sans-serif" },
    topBar:     { backgroundColor: '#FFF', borderBottom: '1px solid #E5E5E3', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center' },
    breadcrumb: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 },
    body:       { padding: 32 },
    pageTitle:  { fontSize: 22, fontWeight: 700, marginBottom: 4, color: '#1A1A1A' },
    weekLabel:  { fontSize: 13, color: '#888', marginBottom: 24, marginTop: 0 },
    state:      { padding: '40px 0', textAlign: 'center', color: '#888', fontSize: 14 },
    empty:      { padding: '40px 24px', textAlign: 'center', color: '#888', fontSize: 14 },

    layout:     { display: 'flex', gap: 24, alignItems: 'flex-start' },
    tableWrap:  { flex: 1, backgroundColor: '#FFF', border: '1px solid #E8E8E6', borderRadius: 8, overflow: 'hidden' },

    table:      { width: '100%', borderCollapse: 'collapse' },
    th:         { padding: '12px 16px', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', borderBottom: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' },
    tr:         { borderBottom: '1px solid #F0F0EE' },
    trMe:       { borderBottom: '1px solid #F0F0EE', backgroundColor: '#FFF5F5' },
    td:         { padding: '14px 16px', fontSize: 14, color: '#1A1A1A', verticalAlign: 'middle' },
    tdRank:     { padding: '14px 16px', textAlign: 'center', fontSize: 16, verticalAlign: 'middle' },
    tdNum:      { textAlign: 'center' },
    rankNum:    { fontSize: 14, fontWeight: 600, color: '#888' },

    memberCell: { display: 'flex', alignItems: 'center', gap: 10 },
    avatar:     { width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#FFF', flexShrink: 0 },
    username:   { fontSize: 14, fontWeight: 600, color: '#1A1A1A', display: 'flex', alignItems: 'center', gap: 6 },
    fullName:   { fontSize: 12, color: '#888', marginTop: 1 },
    youBadge:   { fontSize: 10, fontWeight: 700, backgroundColor: '#CC0000', color: '#FFF', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.03em' },

    sidebar:    { width: 260, display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 },

    rankCard:   { backgroundColor: '#1A1A1A', borderRadius: 8, padding: '20px 20px', color: '#FFF', textAlign: 'center' },
    rankCardTitle: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#AAA', marginBottom: 12 },
    bigRank:    { fontSize: 48, fontWeight: 800, color: '#CC0000', lineHeight: 1 },
    bigPts:     { fontSize: 22, fontWeight: 700, color: '#FFF', marginTop: 6 },
    rankSub:    { fontSize: 12, color: '#888', marginTop: 6 },

    sideCard:   { backgroundColor: '#FFF', border: '1px solid #E8E8E6', borderRadius: 8, padding: '16px 20px' },
    sideCardTitle: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: 12 },
    pointsRow:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '5px 0' },

    rulesList:  { margin: 0, padding: '0 0 0 16px', fontSize: 12, color: '#555', lineHeight: 1.8 },
};
