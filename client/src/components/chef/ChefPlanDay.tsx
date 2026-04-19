// ============================================================
//  ChefPlanDay — Plan del día
//
//  Pipeline: empty state → loading → plan generado → error
//  Layout P13 clean. Sonnet genera via POST /api/planner/day.
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { isPro } from '../../utils/levels';
import { describeChefError, formatUsageBadge, type ChefError } from './chefErrors';
import ChefFreeLock from './ChefFreeLock';
import ChefMealEditor, { type EditableMeal } from './ChefMealEditor';
import ChefWarningBanner from './ChefWarningBanner';
import { daySummaryWarnings, type DayWarnings, type BannerData } from './chefWarningMessages';
import { pickChefTipCard, type ChefTipCard } from './chefTips';
import { renderLoadingCard } from './ChefLoadingCard';
import { recomputeTotals } from './chefTotals';

type Meal = {
  type: string;
  time: string;
  name: string;
  kcal: number;
  ingredients: string;
  protein: number;
  carbs: number;
  fat: number;
};

type PlanData = {
  meals: Meal[];
  totals: { kcal: number; protein: number; carbs: number; fat: number };
};

type Remaining = { kcal: number; protein: number; carbs: number; fat: number };

// Normaliza meal.type (ES o EN) al set español usado por el backend.
// Paridad con TYPE_MAP de worker/src/routes/planner.js.
function normalizeMealType(raw: string | undefined): string | null {
  const t = (raw || '').toLowerCase().trim();
  const MAP: Record<string, string> = {
    desayuno: 'desayuno', breakfast: 'desayuno',
    comida:   'comida',   lunch:     'comida',
    merienda: 'merienda', snack:     'merienda',
    cena:     'cena',     dinner:    'cena',
  };
  return MAP[t] || null;
}

// Detalle de una entry ya registrada hoy. Paridad con resolveMealItems
// de worker/src/utils/mealTypeInfer.js. Lo usamos para marcar "REGISTRADA"
// sólo los meals del plan cuyo NOMBRE coincide con algo ya registrado —
// no por tipo suelto (bug reportado 2026-04-19: merienda se marcaba por
// cualquier entry en esa franja horaria, aunque fuese otro plato).
type RegisteredItem = { type: string; name: string; normalized_name: string };

function normalizeDishName(name: string | undefined): string {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMealRegistered(meal: Meal, items: RegisteredItem[]): boolean {
  const mealType = normalizeMealType(meal.type);
  if (!mealType) return false;
  const mealName = normalizeDishName(meal.name);
  if (!mealName) return false;
  return items.some(it => it.type === mealType && it.normalized_name === mealName);
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

const CHEF_BG = 'var(--bg)';
const CHEF_INK = 'var(--chef-ink)';

// Clave por-usuario. Crítico: sin el userId, un user A podía ver el
// plan cacheado de un user B en el mismo navegador tras logout/login.
const storageKey = (userId: number | string | undefined) =>
  userId ? `caliro_day_plan_u${userId}` : null;

type CachedPlan = {
  plan: PlanData;
  remaining: Remaining | null;
  registeredTypes: Set<string>;
  registeredItems: RegisteredItem[];
  status: Status;
};

function loadCachedPlan(userId: number | string | undefined): CachedPlan | null {
  try {
    const key = storageKey(userId);
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    // Solo válido si es de hoy
    const today = new Date().toLocaleDateString('en-CA');
    if (cached.date !== today || !cached.plan) return null;
    const itemsRaw = Array.isArray(cached.registered_meal_items) ? cached.registered_meal_items : [];
    // Tolerante a shape antiguo (sólo types sin items) — items queda vacío
    // y el backend lo repoblará en el siguiente GET /day/current.
    return {
      plan: cached.plan,
      remaining: cached.remaining || null,
      registeredTypes: new Set(Array.isArray(cached.registered_meal_types) ? cached.registered_meal_types : []),
      registeredItems: itemsRaw.filter((it: any) =>
        it && typeof it.type === 'string' && typeof it.normalized_name === 'string'
      ),
      status: 'ready',
    };
  } catch {
    return null;
  }
}

function savePlanToCache(
  plan: PlanData,
  userId: number | string | undefined,
  remaining?: Remaining | null,
  registeredTypes?: Set<string>,
  registeredItems?: RegisteredItem[],
) {
  try {
    const key = storageKey(userId);
    if (!key) return;
    const today = new Date().toLocaleDateString('en-CA');
    localStorage.setItem(key, JSON.stringify({
      date: today,
      plan,
      remaining: remaining || null,
      registered_meal_types: registeredTypes ? Array.from(registeredTypes) : [],
      registered_meal_items: registeredItems || [],
    }));
  } catch { /* silent — localStorage full or unavailable */ }
}

function clearPlanCache(userId: number | string | undefined) {
  try {
    const key = storageKey(userId);
    if (key) localStorage.removeItem(key);
  } catch {}
}

export default function ChefPlanDay() {
  const navigate = useNavigate();
  const { token, user: authUser } = useAuth();
  const userId = authUser?.id;
  const cached = loadCachedPlan(userId);
  const [status, setStatus] = useState<Status>(cached?.status || 'idle');
  const [plan, setPlan] = useState<PlanData | null>(cached?.plan || null);
  const [error, setError] = useState<ChefError | null>(null);
  const [context, setContext] = useState(''); // input de contexto opcional
  const [remainingDay, setRemainingDay] = useState<number | null>(null);
  const [targetKcal, setTargetKcal] = useState<number>(0);
  // remainingBudget = kcal/macros que le quedaban al user cuando se generó
  // el plan (o cuando se hizo GET current). Null si el plan se cargó de cache
  // sin ese dato. Se usa para calcular el diff honesto en el footer.
  const [remainingBudget, setRemainingBudget] = useState<Remaining | null>(cached?.remaining || null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  // Carta mostrada durante loading — 1 por petición, random sin repetir las
  // últimas 2 vistas. Cada carta son 3 tips numerados con un tema coherente.
  const [loadingCard, setLoadingCard] = useState<ChefTipCard | null>(null);
  // Tipos de comida ya registrados hoy (desde el backend). Usado por el
  // batch "Registrar pendientes" para no duplicar slots (si user ya comió
  // merienda, no registrar la merienda del plan automáticamente).
  const [registeredTypes, setRegisteredTypes] = useState<Set<string>>(cached?.registeredTypes || new Set());
  // Detalle {type, name, normalized_name} de cada entry ya registrada hoy.
  // Usado para marcar "REGISTRADA" en la UI sólo los meals del plan cuyo
  // NOMBRE coincide — evita falso positivo si el user comió otra cosa en
  // la misma franja horaria (bug 2026-04-19).
  const [registeredItems, setRegisteredItems] = useState<RegisteredItem[]>(cached?.registeredItems || []);
  // Estado del batch "Registrar todo" — durante la ejecución bloqueamos el
  // botón y mostramos spinner. Si alguno falla, batchMessage lo cuenta abajo.
  const [batching, setBatching] = useState(false);
  const [batchMessage, setBatchMessage] = useState<string>('');
  // Warnings vienen en la respuesta de generación (POST). GET current no los
  // persiste — si el usuario recarga la página, los banners desaparecen.
  // Aceptable V1: los warnings son más relevantes recién generado el plan.
  const [banners, setBanners] = useState<BannerData[]>([]);
  // Error persistente de guardado (edición fallida). Antes el save era
  // fire-and-forget — si la red caía, el cache local quedaba más nuevo que
  // backend y el próximo fetch silenciosamente pisaba el cambio. Ahora el
  // user ve un banner "No se pudo guardar · Reintentar".
  const [saveError, setSaveError] = useState<boolean>(false);
  // Fecha de mount — detectar cruce de medianoche cuando el user tiene la
  // app abierta en segundo plano (patrón común: deja el tab abierto y vuelve
  // al día siguiente). Sin este ref, seguiría viendo el plan de ayer.
  const mountedDateRef = useRef<string>(new Date().toLocaleDateString('en-CA'));

  const today = new Date();
  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const dateStr = `${dayNames[today.getDay()]} ${today.getDate()} de ${monthNames[today.getMonth()]}`;

  const userIsPro = isPro(authUser?.access_level);

  // Cross-device sync + usage: en mount pide último plan guardado + remaining.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const [planRes, usageRes] = await Promise.all([
          api.chefGetCurrentDay(token),
          api.chefGetUsage(token),
        ]);
        if (cancelled) return;
        if (planRes?.plan) {
          setPlan(planRes.plan);
          if (planRes.target_kcal) setTargetKcal(planRes.target_kcal);
          if (planRes.remaining) setRemainingBudget(planRes.remaining);
          const regSet = Array.isArray(planRes.registered_meal_types)
            ? new Set<string>(planRes.registered_meal_types)
            : new Set<string>();
          setRegisteredTypes(regSet);
          const regItems: RegisteredItem[] = Array.isArray(planRes.registered_meal_items)
            ? planRes.registered_meal_items
            : [];
          setRegisteredItems(regItems);
          savePlanToCache(planRes.plan, userId, planRes.remaining, regSet, regItems);
          setStatus('ready');
        } else {
          // Backend confirma que NO hay plan para este user hoy → descartar
          // cualquier cache local (podría ser de otro user en este navegador)
          setPlan(null);
          setRemainingBudget(null);
          clearPlanCache(userId);
          setStatus('idle');
        }
        if (usageRes?.day) {
          setRemainingDay(usageRes.day.remaining_day);
        }
      } catch { /* silent: dejamos el cache local si el fetch falla */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Cross-medianoche: si el user tiene la app abierta en background y vuelve
  // al día siguiente, detectamos el cambio de fecha al recibir visibilitychange
  // y refrescamos. Sin esto, seguiría viendo el plan de ayer hasta recargar.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      if (!token) return;
      const currentDate = new Date().toLocaleDateString('en-CA');
      if (currentDate === mountedDateRef.current) return; // mismo día, nada que hacer
      mountedDateRef.current = currentDate;
      // Limpiar todo lo del día anterior
      clearPlanCache(userId);
      setPlan(null);
      setRemainingBudget(null);
      setRegisteredTypes(new Set());
      setRegisteredItems([]);
      setBanners([]);
      setSaveError(false);
      setStatus('idle');
      // Re-fetch (mismo flujo que el mount useEffect). Si no hay plan para
      // HOY, quedará en idle y el user verá el action page para generar.
      (async () => {
        try {
          const [planRes, usageRes] = await Promise.all([
            api.chefGetCurrentDay(token),
            api.chefGetUsage(token),
          ]);
          if (planRes?.plan) {
            setPlan(planRes.plan);
            if (planRes.target_kcal) setTargetKcal(planRes.target_kcal);
            if (planRes.remaining) setRemainingBudget(planRes.remaining);
            const regSet = Array.isArray(planRes.registered_meal_types)
              ? new Set<string>(planRes.registered_meal_types)
              : new Set<string>();
            setRegisteredTypes(regSet);
            const regItems: RegisteredItem[] = Array.isArray(planRes.registered_meal_items)
              ? planRes.registered_meal_items
              : [];
            setRegisteredItems(regItems);
            savePlanToCache(planRes.plan, userId, planRes.remaining, regSet, regItems);
            setStatus('ready');
          }
          if (usageRes?.day) setRemainingDay(usageRes.day.remaining_day);
        } catch {}
      })();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userId]);

  async function handleGenerate() {
    setStatus('loading');
    setError(null);
    setBanners([]);
    setLoadingCard(pickChefTipCard());
    try {
      const res = await api.chefPlanDay({ context: context || undefined }, token);
      if (res.plan) {
        setPlan(res.plan);
        // El backend devuelve `remaining_before` al generar (kcal/macros que
        // le quedaban al user en ese momento). Lo guardamos para calcular el
        // diff correcto en el footer — comparar plan vs remaining, no vs total.
        const remaining = res.remaining_before || null;
        setRemainingBudget(remaining);
        const regSet = Array.isArray(res.registered_meal_types)
          ? new Set<string>(res.registered_meal_types)
          : new Set<string>();
        setRegisteredTypes(regSet);
        const regItems: RegisteredItem[] = Array.isArray(res.registered_meal_items)
          ? res.registered_meal_items
          : [];
        setRegisteredItems(regItems);
        savePlanToCache(res.plan, userId, remaining, regSet, regItems);
        if (res.target_kcal) setTargetKcal(res.target_kcal);
        if (typeof res?.usage?.remaining_day === 'number') {
          setRemainingDay(res.usage.remaining_day);
        }
        // Mapear warnings del backend a banners renderizables.
        setBanners(daySummaryWarnings(res.warnings as DayWarnings | null));
        setStatus('ready');
      } else {
        throw Object.assign(new Error(res.error || 'No se recibió un plan válido'), {
          data: res,
        });
      }
    } catch (err: any) {
      setError(describeChefError(err, 'day'));
      setStatus('error');
    }
  }

  function handleRegister(meal: Meal) {
    // Marca optimista: agregamos el item (type + name normalizado) Y el tipo
    // al set ANTES de navegar a Calculator. Si el user guarda en Calculator,
    // el backend tendrá la entry y el próximo mount re-confirmará. Si cancela,
    // próximo mount re-fetchea el estado real y corrige.
    const normalized = normalizeMealType(meal.type);
    if (normalized) {
      const nextSet = new Set(registeredTypes);
      nextSet.add(normalized);
      setRegisteredTypes(nextSet);
      const normalizedName = normalizeDishName(meal.name);
      let nextItems = registeredItems;
      if (normalizedName) {
        // Dedup: si ya existe un item con mismo type+normalized_name no añadir.
        const exists = registeredItems.some(it =>
          it.type === normalized && it.normalized_name === normalizedName
        );
        if (!exists) {
          nextItems = [...registeredItems, {
            type: normalized,
            name: meal.name,
            normalized_name: normalizedName,
          }];
          setRegisteredItems(nextItems);
        }
      }
      if (plan) savePlanToCache(plan, userId, remainingBudget, nextSet, nextItems);
    }
    navigate('/calculator', {
      state: {
        prefill: {
          name: meal.name,
          calories: String(meal.kcal),
          protein: String(meal.protein),
          carbs: String(meal.carbs),
          fat: String(meal.fat),
          // portion_g → weight si existe (peso total del plato servido)
          weight: (meal as any).portion_g ? String((meal as any).portion_g) : '',
          // type español del plan → Calculator lo mapea a meal_type inglés
          meal_type: meal.type,
          // ingredients como referencia en notes
          ingredients: meal.ingredients || '',
        },
      },
    });
  }

  // Guardado al backend con feedback al user. Si falla, el banner saveError
  // informa + ofrece reintentar. Antes era fire-and-forget — perdíamos
  // ediciones silenciosamente cuando la red caía y el próximo fetch del
  // backend pisaba el cache local.
  async function trySaveDay(planToSave: PlanData) {
    try {
      await api.chefSaveDay(planToSave, token);
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }

  function handleSaveEdit(updated: EditableMeal) {
    if (editingIdx == null || !plan) return;
    const nextMeals = plan.meals.map((m, i) =>
      i === editingIdx ? { ...m, ...updated } : m
    );
    const nextPlan: PlanData = {
      ...plan,
      meals: nextMeals,
      totals: recomputeTotals(nextMeals),
    };
    setPlan(nextPlan);
    savePlanToCache(nextPlan, userId, remainingBudget, registeredTypes, registeredItems);
    setEditingIdx(null);
    trySaveDay(nextPlan);
  }

  function handleRetrySave() {
    if (!plan) return;
    trySaveDay(plan);
  }

  // ── Register All ─────────────────────────────────────────
  // Batch sequential: para cada meal pendiente, llamamos a api.saveEntry
  // con el mapping ES→EN del meal_type (mismo que hace Calculator al
  // recibir prefill). UI progresiva: marcamos cada meal tras su éxito,
  // así si algo falla a mitad el usuario ve qué se registró y qué no.
  async function handleRegisterAll() {
    if (!plan || batching) return;
    const ES_TO_EN: Record<string, string> = {
      desayuno: 'breakfast',
      comida:   'lunch',
      merienda: 'snack',
      cena:     'dinner',
    };

    // Solo meals cuyo tipo NO está ya en registeredTypes.
    const pending = plan.meals.filter(m => {
      const normType = normalizeMealType(m.type);
      return normType && !registeredTypes.has(normType);
    });
    if (pending.length === 0) return;

    setBatching(true);
    setBatchMessage('');
    const accumulatedTypes = new Set<string>(registeredTypes);
    const accumulatedItems: RegisteredItem[] = [...registeredItems];
    let successCount = 0;
    let failCount = 0;

    for (const meal of pending) {
      try {
        const rawType = (meal.type || '').toLowerCase();
        const mealType = ES_TO_EN[rawType] || rawType;
        await api.saveEntry({
          meal_type: mealType,
          name:      meal.name || null,
          calories:  Math.round(meal.kcal),
          protein:   Math.round(meal.protein) || null,
          carbs:     Math.round(meal.carbs)   || null,
          fat:       Math.round(meal.fat)     || null,
          weight:    (meal as any).portion_g || null,
          notes:     meal.ingredients || null,
        }, token);
        successCount++;
        const normType = normalizeMealType(meal.type);
        const normName = normalizeDishName(meal.name);
        if (normType) {
          accumulatedTypes.add(normType);
          setRegisteredTypes(new Set(accumulatedTypes));
          if (normName && !accumulatedItems.some(it =>
            it.type === normType && it.normalized_name === normName
          )) {
            accumulatedItems.push({
              type: normType,
              name: meal.name,
              normalized_name: normName,
            });
            // Actualización progresiva — el user ve las marcas "REGISTRADA"
            // apareciendo una a una durante el batch.
            setRegisteredItems([...accumulatedItems]);
          }
        }
      } catch {
        failCount++;
        // Seguimos intentando los demás — no abortamos el batch.
      }
    }

    savePlanToCache(plan, userId, remainingBudget, accumulatedTypes, accumulatedItems);
    setBatching(false);

    if (failCount === 0) {
      setBatchMessage(`${successCount === 1 ? '1 plato registrado' : `${successCount} platos registrados`}`);
      setTimeout(() => setBatchMessage(''), 2500);
    } else if (successCount === 0) {
      setBatchMessage('No se pudo registrar ninguno. Revisa tu conexión.');
    } else {
      setBatchMessage(`${successCount} de ${successCount + failCount} registrados. Reintenta los pendientes individualmente.`);
    }
  }

  // Shared wrapper for non-plan states (card container)
  const stateWrapper = (children: React.ReactNode) => (
    <div style={{
      flex: 1,
      background: CHEF_BG,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '40px 28px',
        textAlign: 'center',
        width: '100%',
        maxWidth: 360,
      }}>
        {children}
      </div>
    </div>
  );

  // ── FREE/WAITLIST: empty state de upgrade en idle + error 429 blocked ──
  if (!userIsPro && (status === 'idle' || (status === 'error' && error?.title === 'Función Pro'))) {
    return <ChefFreeLock feature="day" />;
  }

  // ── IDLE: Action page para generar plan ──
  if (status === 'idle') {
    return (
      <div style={{
        flex: 1,
        background: CHEF_BG,
        overflowY: 'auto',
        padding: '24px 20px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Card contenedora */}
        <div style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 22px 28px',
          maxWidth: 420,
          width: '100%',
          margin: '0 auto',
        }}>
          {/* Header: icon + title + date */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(45,106,79,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                   stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <line x1="8" y1="8" x2="16" y2="8" />
                <line x1="8" y1="11.5" x2="16" y2="11.5" />
                <line x1="8" y1="15" x2="16" y2="15" />
                <line x1="8" y1="18.5" x2="13" y2="18.5" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: 22,
                color: CHEF_INK,
                margin: 0,
                lineHeight: 1.1,
                fontWeight: 400,
              }}>
                Plan del día
              </h2>
              <div style={{
                fontSize: 10,
                color: 'var(--text-tertiary)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginTop: 4,
              }}>
                {dateStr}
                {formatUsageBadge(remainingDay, 'hoy') && (
                  <>
                    {' · '}
                    <span style={{
                      color: remainingDay === 0 ? 'var(--accent-2)' : 'var(--text-tertiary)',
                      fontWeight: 600,
                    }}>
                      {formatUsageBadge(remainingDay, 'hoy')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <p style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            margin: '0 0 20px',
          }}>
            Genera 4 comidas personalizadas basadas en tu objetivo calórico y tus comidas frecuentes.
          </p>

          {/* Separator */}
          <div style={{ height: '0.5px', background: 'var(--border)', marginBottom: 18 }} />

          {/* Context input (optional) */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              fontSize: 10,
              color: 'var(--text-tertiary)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 600,
              display: 'block',
              marginBottom: 6,
            }}>
              Contexto
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 4, color: 'var(--text-tertiary)' }}>
                opcional
              </span>
            </label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Algo rápido, tengo pollo, solo cena, estoy en restaurante…"
              rows={2}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'var(--bg)',
                border: '0.5px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                resize: 'none',
                outline: 'none',
                lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={remainingDay === 0}
            style={{
              width: '100%',
              background: remainingDay === 0 ? 'var(--text-tertiary)' : 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: '13px 24px',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              cursor: remainingDay === 0 ? 'not-allowed' : 'pointer',
              boxShadow: remainingDay === 0 ? 'none' : '0 2px 8px rgba(45,106,79,0.2)',
              opacity: remainingDay === 0 ? 0.6 : 1,
            }}
          >
            {remainingDay === 0 ? 'Límite diario alcanzado' : 'Generar plan'}
          </button>
        </div>

        {/* Footer context info */}
        <p style={{
          fontSize: 10,
          color: 'var(--text-tertiary)',
          textAlign: 'center',
          marginTop: 16,
          lineHeight: 1.5,
          fontStyle: 'italic',
        }}>
          {targetKcal > 0
            ? `Basado en tu objetivo de ${targetKcal} kcal y tus preferencias dietéticas`
            : 'Basado en tu objetivo calórico y tus preferencias dietéticas'}
        </p>
      </div>
    );
  }

  // ── LOADING ──
  if (status === 'loading') {
    return renderLoadingCard({
      title: 'Preparando tu plan…',
      card: loadingCard,
    });
  }

  // ── ERROR ──
  if (status === 'error') {
    const toneColor =
      error?.tone === 'info'  ? 'var(--text-secondary)' :
      error?.tone === 'warn'  ? '#c89424' :  /* saffron */
      'var(--accent-2)';
    return stateWrapper(<>
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 17,
          color: toneColor,
          marginBottom: 8,
          lineHeight: 1.2,
        }}>
          {error?.title || 'No se pudo generar el plan'}
        </div>
        <p style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          margin: '0 0 18px',
          lineHeight: 1.5,
        }}>
          {error?.detail || 'Inténtalo de nuevo en un momento.'}
        </p>
        {error?.retryLabel && (
          <button
            type="button"
            onClick={handleGenerate}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: '10px 24px',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
          >
            {error.retryLabel}
          </button>
        )}
        {!error?.retryLabel && (
          <button
            type="button"
            onClick={() => { setError(null); setStatus(plan ? 'ready' : 'idle'); }}
            style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-full)',
              padding: '9px 22px',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
          >
            Entendido
          </button>
        )}
    </>);
  }

  // ── READY: Plan generado (layout P13 clean) ──
  // Stagger animation: each meal fades in with slight delay
  const staggerStyle = (i: number): React.CSSProperties => ({
    opacity: 0,
    animation: 'chefFadeInUp 0.35s ease forwards',
    animationDelay: `${i * 0.1}s`,
  });

  if (!plan) return null;

  // Footer diff — comparamos contra lo que al user le QUEDA del día, no contra
  // el target total. Si el plan tiene 697 kcal y al user le quedaban 700 tras
  // ya haber comido 1100, eso ES "dentro del rango", aunque el target diario
  // sea 1800. Antes mostrábamos -1115 (dentro del rango) → confuso.
  const planKcal = plan.totals.kcal;
  const hasRemaining = !!(remainingBudget && remainingBudget.kcal > 0 && remainingBudget.kcal < targetKcal);
  const isOverBudget = !!(remainingBudget && remainingBudget.kcal <= 0);
  const reference = hasRemaining ? remainingBudget!.kcal : targetKcal;
  const tolerance = reference * 0.10;
  const diff = reference > 0 ? planKcal - reference : 0;

  // Status pill text
  let footerStatus = '';
  if (isOverBudget) {
    footerStatus = `Ya superaste tu objetivo por ${Math.abs(remainingBudget!.kcal)} kcal`;
  } else if (reference > 0) {
    const sign = diff > 0 ? '+' : '−';
    const absDiff = Math.abs(diff);
    let relation: string;
    if (absDiff <= tolerance) relation = 'dentro del rango';
    else if (diff > 0)         relation = `${sign}${absDiff} kcal sobre`;
    else                       relation = `${sign}${absDiff} kcal por debajo`;
    const refLabel = hasRemaining
      ? `${Math.round(reference)} kcal restantes`
      : `Objetivo ${Math.round(reference)} kcal`;
    footerStatus = `${refLabel} · ${relation}`;
  }

  const totalG = plan.totals.protein + plan.totals.carbs + plan.totals.fat;
  const pPct = totalG > 0 ? (plan.totals.protein / totalG) * 100 : 33;
  const cPct = totalG > 0 ? (plan.totals.carbs / totalG) * 100 : 34;
  const fPct = 100 - pPct - cPct;

  return (
    <div style={{
      flex: 1,
      background: CHEF_BG,
      overflowY: 'auto',
      padding: '20px 22px 24px',
    }}>
      <style>{`
        @keyframes chefFadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingBottom: 16,
        marginBottom: 20,
        borderBottom: '0.5px solid var(--border-strong)',
      }}>
        <div>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 26,
            color: CHEF_INK,
            margin: 0,
            lineHeight: 1,
          }}>
            Plan del día
          </h2>
          <div style={{
            fontSize: 10,
            color: 'var(--text-tertiary)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginTop: 4,
            fontWeight: 500,
          }}>
            {dateStr}
            {formatUsageBadge(remainingDay, 'hoy') && (
              <>
                {' · '}
                <span style={{
                  color: remainingDay === 0 ? 'var(--accent-2)' : 'var(--text-tertiary)',
                  fontWeight: 600,
                }}>
                  {formatUsageBadge(remainingDay, 'hoy')}
                </span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setPlan(null); clearPlanCache(userId); setBanners([]); setRemainingBudget(null); setRegisteredTypes(new Set()); setRegisteredItems([]); setStatus('idle'); }}
          style={{
            fontSize: 10,
            color: 'var(--text-secondary)',
            background: 'transparent',
            border: '0.5px solid var(--border-strong)',
            borderRadius: 'var(--radius-full)',
            padding: '5px 11px',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Regenerar todo
        </button>
      </div>

      {/* Warnings del backend — stack de banners editoriales (nutritional safety). */}
      {banners.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {banners.map((b, i) => (
            <ChefWarningBanner key={i} tone={b.tone} title={b.title}>
              {b.detail}
            </ChefWarningBanner>
          ))}
        </div>
      )}

      {/* Save error — edición persistida en cache local pero no en backend.
          Antes se perdía silenciosamente; ahora el user ve el fallo y puede
          reintentar. El plan local sigue mostrando el cambio, solo falta
          confirmar con el servidor. */}
      {saveError && (
        <div style={{
          background: 'rgba(231,111,81,0.08)',
          border: '0.5px solid rgba(231,111,81,0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <span style={{
            fontSize: 12,
            color: 'var(--accent-2)',
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.4,
          }}>
            No se pudo guardar el cambio en el servidor. Tu edición sigue visible aquí.
          </span>
          <button
            type="button"
            onClick={handleRetrySave}
            style={{
              background: 'var(--accent-2)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: '5px 14px',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Meals — ordenados por hora (evita el caso Comida 14h → Desayuno 11h
          que aparecía cuando Sonnet devolvía el array desordenado). Llevamos
          originalIdx porque handleSaveEdit indexa sobre plan.meals (no sorted). */}
      {plan.meals
        .map((meal, originalIdx) => ({ meal, originalIdx }))
        .sort((a, b) => (a.meal.time || '').localeCompare(b.meal.time || ''))
        .map(({ meal, originalIdx }, i, sortedMeals) => {
        // Match por NOMBRE + tipo (no sólo tipo). Ver isMealRegistered para
        // el porqué. registeredTypes sigue usándose abajo para el batch
        // "Registrar pendientes" (invariante: no duplicar slots).
        const mealRegistered = isMealRegistered(meal, registeredItems);
        return (
        <div key={originalIdx} style={{
          ...staggerStyle(i),
          opacity: mealRegistered ? 0.55 : 1,
          transition: 'opacity 0.2s',
        }}>
          <div style={{ marginBottom: 24 }}>
            {/* Meal caption */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 6,
            }}>
              <span style={{
                fontSize: 9,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: CHEF_INK,
                fontWeight: 700,
              }}>
                {meal.type}
                {mealRegistered && (
                  <span style={{
                    marginLeft: 8,
                    color: 'var(--accent)',
                    fontWeight: 600,
                  }}>
                    · REGISTRADA
                  </span>
                )}
              </span>
              <span style={{
                fontSize: 10,
                color: 'var(--text-tertiary)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {meal.time}
              </span>
            </div>

            {/* Main row: info + register button */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontSize: 20,
                  color: CHEF_INK,
                  lineHeight: 1.2,
                  margin: '0 0 4px',
                  fontWeight: 400,
                }}>
                  {meal.name}
                </h3>
                <div style={{
                  fontSize: 12,
                  color: CHEF_INK,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  marginBottom: 6,
                }}>
                  {meal.kcal} kcal
                </div>
                <div style={{
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                }}>
                  {meal.ingredients}
                </div>
                <button
                  type="button"
                  onClick={() => setEditingIdx(originalIdx)}
                  style={{
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                    marginTop: 8,
                    cursor: 'pointer',
                    display: 'inline-block',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    fontFamily: 'inherit',
                  }}
                >
                  Editar
                </button>
              </div>

              {/* Circular register button — disabled con check si este meal
                  concreto (type+nombre) ya está registrado hoy. */}
              <button
                type="button"
                onClick={() => { if (!mealRegistered) handleRegister(meal); }}
                disabled={mealRegistered}
                title={mealRegistered ? 'Ya registrada hoy' : 'Registrar esta comida'}
                aria-label={mealRegistered ? 'Ya registrada hoy' : 'Registrar esta comida'}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: mealRegistered ? 'var(--surface-2)' : 'var(--accent)',
                  border: mealRegistered ? '0.5px solid var(--border-strong)' : 'none',
                  cursor: mealRegistered ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 4,
                  boxShadow: mealRegistered ? 'none' : '0 2px 6px rgba(45,106,79,0.2)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke={mealRegistered ? 'var(--text-tertiary)' : '#fff'}
                     strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Separator */}
          {i < sortedMeals.length - 1 && (
            <div style={{
              height: '0.5px',
              background: 'var(--border)',
              marginBottom: 24,
            }} />
          )}
        </div>
        );
      })}

      {/* Footer — totals */}
      <div style={{
        ...staggerStyle(plan.meals.length),
        marginTop: 12,
        padding: '16px 18px',
        background: 'var(--chef-footer-bg)',
        color: 'var(--chef-footer-fg)',
        borderRadius: 14,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 10,
        }}>
          <span style={{
            fontSize: 9,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.45)',
            fontWeight: 600,
          }}>
            Total del plan
          </span>
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 24,
          }}>
            {plan.totals.kcal} kcal
          </span>
        </div>
        <div style={{
          display: 'flex',
          height: 4,
          borderRadius: 2,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.1)',
          marginBottom: 8,
        }}>
          <div style={{ width: `${pPct}%`, height: '100%', background: 'var(--color-protein)' }} />
          <div style={{ width: `${cPct}%`, height: '100%', background: 'var(--color-carbs)' }} />
          <div style={{ width: `${fPct}%`, height: '100%', background: 'var(--color-fat)' }} />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'rgba(255,255,255,0.6)',
        }}>
          <span><strong style={{ color: '#fff', fontWeight: 600 }}>{plan.totals.protein}g</strong> prot</span>
          <span><strong style={{ color: '#fff', fontWeight: 600 }}>{plan.totals.carbs}g</strong> carb</span>
          <span><strong style={{ color: '#fff', fontWeight: 600 }}>{plan.totals.fat}g</strong> grasa</span>
        </div>
        {footerStatus && (
          <div style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '0.5px dashed rgba(255,255,255,0.15)',
            fontSize: 10,
            color: 'rgba(255,255,255,0.5)',
            textAlign: 'center',
            fontStyle: 'italic',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {footerStatus}
          </div>
        )}
      </div>

      {/* Registrar todo — solo aparece si quedan meals pendientes. Debajo
          del footer oscuro, centrado. Batch sequential progresivo. */}
      {(() => {
        const pendingCount = plan.meals.reduce((n, m) => {
          const t = normalizeMealType(m.type);
          return t && !registeredTypes.has(t) ? n + 1 : n;
        }, 0);
        const showMessage = !!batchMessage;
        if (pendingCount === 0 && !showMessage) return null;
        return (
          <div style={{
            marginTop: 18,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}>
            {pendingCount > 0 && (
              <button
                type="button"
                onClick={handleRegisterAll}
                disabled={batching}
                style={{
                  background: batching ? 'var(--text-tertiary)' : 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  padding: '11px 24px',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                  cursor: batching ? 'wait' : 'pointer',
                  boxShadow: batching ? 'none' : '0 2px 6px rgba(45,106,79,0.2)',
                  minWidth: 220,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  opacity: batching ? 0.7 : 1,
                }}
              >
                {batching ? (
                  <>
                    <span className="spinner" style={{ width: 12, height: 12 }} />
                    Registrando…
                  </>
                ) : (
                  <>Registrar {pendingCount === 1 ? '1 pendiente' : `${pendingCount} pendientes`}</>
                )}
              </button>
            )}
            {showMessage && (
              <span style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
                fontFamily: 'var(--font-sans)',
                textAlign: 'center',
                maxWidth: 280,
              }}>
                {batchMessage}
              </span>
            )}
          </div>
        );
      })()}

      {/* Modal de edición de meal */}
      <ChefMealEditor
        meal={editingIdx != null && plan?.meals[editingIdx]
          ? (plan.meals[editingIdx] as EditableMeal)
          : null}
        subtitle={editingIdx != null && plan?.meals[editingIdx]
          ? plan.meals[editingIdx].type
          : undefined}
        onSave={handleSaveEdit}
        onClose={() => setEditingIdx(null)}
      />
    </div>
  );
}
