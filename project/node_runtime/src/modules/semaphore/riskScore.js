// Risk Score 0–100 según RF-21/RF-22/RF-23/RF-24/RF-25
function computeRiskScore({
    desviacion,       // number — avance_real minus avance_esperado (puntos porcentuales)
    deadline,         // string ISO o null
    avance_real,      // number 0–100
    costo_aprobado,   // number
    presupuesto,      // number (budget.total_cost; 0 = sin presupuesto)
    blockers,         // [{ severity, approval_status, created_at }]
    activeRisks,      // [{ level: 'low'|'medium'|'high' }]
    recentSP,         // SP cerrados en los últimos 7 días
    expectedWeeklySP, // SP semanales esperados (0 = desconocido)
}) {
    let score = 0;
    const now = new Date();

    // ── 1. Desviación de avance (25 pts) ────────────────────────────────────
    if      (desviacion <= -20) score += 25;
    else if (desviacion <= -10) score += 12;
    else if (desviacion <    0) score +=  5;

    // ── 2. Cercanía al deadline (20 pts) ────────────────────────────────────
    if (deadline) {
        const daysLeft = Math.ceil((new Date(deadline) - now) / 86400000);
        if      (daysLeft <   0) score += 20;
        else if (daysLeft <=  7) score += 15;
        else if (daysLeft <= 30) score +=  8;
    }

    // ── 3. Presión de costo (20 pts) ────────────────────────────────────────
    if (presupuesto > 0) {
        const ratio = costo_aprobado / presupuesto;
        if      (ratio > 1.00) score += 20;
        else if (ratio > 0.85) score += 15;
        else if (ratio > 0.70) score +=  8;
    }

    // ── 4. Bloqueadores activos (15 pts) ────────────────────────────────────
    const criticals = (blockers || []).filter(b =>
        b.severity === 'critical' && ['pending', 'approved'].includes(b.approval_status));
    const mediums = (blockers || []).filter(b =>
        b.severity === 'medium' && b.approval_status === 'pending');

    if      (criticals.length >= 2) score += 15;
    else if (criticals.length >= 1) score += 10;
    else if (mediums.length   >= 1) score +=  5;

    // ── 5. Riesgos activos HU-21 (10 pts) ───────────────────────────────────
    const levels = (activeRisks || []).map(r => r.level);
    if      (levels.includes('high'))   score += 10;
    else if (levels.includes('medium')) score +=  6;
    else if (levels.length > 0)         score +=  3;

    // ── 6. Velocidad de cierre (10 pts) ─────────────────────────────────────
    if (expectedWeeklySP > 0) {
        if      (recentSP < expectedWeeklySP * 0.50) score += 10;
        else if (recentSP < expectedWeeklySP * 0.75) score +=  5;
    }

    score = Math.min(100, Math.max(0, score));

    // ── Semáforo base por score (RF-23) ─────────────────────────────────────
    let semaforo_en = score >= 70 ? 'red' : score >= 40 ? 'yellow' : 'green';

    // ── Override RF-24: deadline vencido + avance < 100% → Rojo ─────────────
    if (deadline && new Date(deadline) < now && avance_real < 100) {
        semaforo_en = 'red';
    }

    // ── Override RF-25: mínimo Amarillo ─────────────────────────────────────
    // Costo aprobado > presupuesto
    if (presupuesto > 0 && costo_aprobado > presupuesto && semaforo_en === 'green') {
        semaforo_en = 'yellow';
    }
    // Blocker crítico activo > 3 días
    const threeDaysAgo = new Date(now - 3 * 86400000);
    const critOver3Days = criticals.some(b => new Date(b.created_at) < threeDaysAgo);
    if (critOver3Days && semaforo_en === 'green') {
        semaforo_en = 'yellow';
    }

    const toSpanish = { green: 'verde', yellow: 'amarillo', red: 'rojo' };
    return { score, semaforo_en, semaforo: toSpanish[semaforo_en] };
}

module.exports = { computeRiskScore };
