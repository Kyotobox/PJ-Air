'use client';

import React, { useState, useEffect, useMemo } from 'react';
import AdminSidebar from '@/components/layout/AdminSidebar';
import {
    Calendar as CalendarIcon,
    Clock,
    Check,
    X,
    Plus,
    Trash2,
    Save,
    RotateCcw,
    Loader2,
    Sparkles,
    AlertCircle,
    CheckCircle2,
    Flag,
    CalendarCheck,
    CalendarX,
    Info,
    CalendarDays,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import {
    DeliveryScheduleConfig,
    DeliveryHoliday,
    DeliveryExceptionalDay,
    DEFAULT_DELIVERY_SCHEDULE,
    OFFICIAL_US_NY_HOLIDAYS,
    DAY_NAMES_ES,
    DAY_NAMES_EN,
    formatDeliveryDatePretty,
} from '@/lib/delivery-schedule';

export default function AdminDispatchPage() {
    const { locale } = useLanguage();
    const isEn = locale === 'en';

    // State
    const [schedule, setSchedule] = useState<DeliveryScheduleConfig>(DEFAULT_DELIVERY_SCHEDULE);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Inputs para nuevo feriado
    const [newHolidayDate, setNewHolidayDate] = useState('');
    const [newHolidayName, setNewHolidayName] = useState('');

    // Inputs para nueva excepción extraordinaria
    const [newExceptionalDate, setNewExceptionalDate] = useState('');
    const [newExceptionalName, setNewExceptionalName] = useState('');

    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    // Cargar cronograma desde backend con fallback offline-first (§45)
    const fetchSchedule = async () => {
        try {
            setLoading(true);
            const data = await api.get('/configs/delivery-schedule') as any;
            if (data && typeof data === 'object') {
                setSchedule({
                    workingDays: Array.isArray(data.workingDays) ? data.workingDays : DEFAULT_DELIVERY_SCHEDULE.workingDays,
                    holidays: Array.isArray(data.holidays) ? data.holidays : DEFAULT_DELIVERY_SCHEDULE.holidays,
                    exceptionalDays: Array.isArray(data.exceptionalDays) ? data.exceptionalDays : [],
                    cutoffHour: typeof data.cutoffHour === 'number' ? data.cutoffHour : 12,
                });
            } else {
                setSchedule(DEFAULT_DELIVERY_SCHEDULE);
            }
        } catch (err: any) {
            console.warn('API delivery-schedule no disponible o error, usando fallback offline:', err);
            setSchedule(DEFAULT_DELIVERY_SCHEDULE);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSchedule();
    }, []);

    // ── Toggle de días de la semana ──────────────────────────────────────────
    const toggleWorkingDay = (dayIndex: number) => {
        setSchedule(prev => {
            const current = new Set(prev.workingDays);
            if (current.has(dayIndex)) {
                // Prevenir desmarcar todos los días
                if (current.size === 1) {
                    showToast(
                        isEn ? 'At least one operating day must remain active.' : 'Debe permanecer al menos un día operativo activo.',
                        'error'
                    );
                    return prev;
                }
                current.delete(dayIndex);
            } else {
                current.add(dayIndex);
            }
            return {
                ...prev,
                workingDays: Array.from(current).sort((a, b) => a - b),
            };
        });
    };

    // ── Gestor de Feriados ───────────────────────────────────────────────────
    const handleAddHoliday = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newHolidayDate) {
            showToast(isEn ? 'Please select a date for the holiday.' : 'Por favor selecciona una fecha para el festivo.', 'error');
            return;
        }
        if (!newHolidayName.trim()) {
            showToast(isEn ? 'Please provide a name for the holiday.' : 'Por favor ingresa un nombre para el festivo.', 'error');
            return;
        }

        // Evitar duplicados de fecha
        const exists = schedule.holidays.some(h => h.date === newHolidayDate);
        if (exists) {
            showToast(
                isEn ? 'This date is already registered as a holiday.' : 'Esta fecha ya se encuentra registrada como festivo.',
                'error'
            );
            return;
        }

        const updatedHolidays: DeliveryHoliday[] = [
            ...schedule.holidays,
            { date: newHolidayDate, name: newHolidayName.trim() },
        ].sort((a, b) => a.date.localeCompare(b.date));

        setSchedule(prev => ({ ...prev, holidays: updatedHolidays }));
        setNewHolidayDate('');
        setNewHolidayName('');
        showToast(isEn ? 'Holiday registered successfully.' : 'Festivo agregado exitosamente.', 'success');
    };

    const handleRemoveHoliday = (dateToRemove: string) => {
        setSchedule(prev => ({
            ...prev,
            holidays: prev.holidays.filter(h => h.date !== dateToRemove),
        }));
    };

    // Carga de 1 clic de Feriados Oficiales NY/US sin duplicados
    const handleLoadOfficialHolidays = () => {
        const existingDates = new Set(schedule.holidays.map(h => h.date));
        const newToAdd: DeliveryHoliday[] = [];

        for (const official of OFFICIAL_US_NY_HOLIDAYS) {
            if (!existingDates.has(official.date)) {
                newToAdd.push(official);
            }
        }

        if (newToAdd.length === 0) {
            showToast(
                isEn ? 'All official NY/US holidays are already registered.' : 'Todos los feriados oficiales NY/US ya están cargados.',
                'info'
            );
            return;
        }

        const combined = [...schedule.holidays, ...newToAdd].sort((a, b) => a.date.localeCompare(b.date));
        setSchedule(prev => ({ ...prev, holidays: combined }));
        showToast(
            isEn ? `Added ${newToAdd.length} official NY/US holidays.` : `Se agregaron ${newToAdd.length} feriados oficiales NY/US.`,
            'success'
        );
    };

    // ── Gestor de Días Extraordinarios (Overrides) ───────────────────────────
    const handleAddExceptionalDay = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newExceptionalDate) {
            showToast(isEn ? 'Please select a date for the override.' : 'Por favor selecciona una fecha para el día extraordinario.', 'error');
            return;
        }
        if (!newExceptionalName.trim()) {
            showToast(isEn ? 'Please specify a reason or event.' : 'Por favor ingresa un motivo o evento para la excepción.', 'error');
            return;
        }

        const exists = schedule.exceptionalDays.some(d => d.date === newExceptionalDate);
        if (exists) {
            showToast(
                isEn ? 'This date is already registered as an exceptional day.' : 'Esta fecha ya se encuentra registrada como día extraordinario.',
                'error'
            );
            return;
        }

        const updatedExceptional: DeliveryExceptionalDay[] = [
            ...schedule.exceptionalDays,
            { date: newExceptionalDate, name: newExceptionalName.trim() },
        ].sort((a, b) => a.date.localeCompare(b.date));

        setSchedule(prev => ({ ...prev, exceptionalDays: updatedExceptional }));
        setNewExceptionalDate('');
        setNewExceptionalName('');
        showToast(isEn ? 'Exceptional dispatch day added.' : 'Día extraordinario de despacho habilitado.', 'success');
    };

    const handleRemoveExceptionalDay = (dateToRemove: string) => {
        setSchedule(prev => ({
            ...prev,
            exceptionalDays: prev.exceptionalDays.filter(d => d.date !== dateToRemove),
        }));
    };

    // ── Guardar Cambios ──────────────────────────────────────────────────────
    const handleSaveSchedule = async () => {
        try {
            setSaving(true);
            const payload = {
                workingDays: schedule.workingDays,
                holidays: schedule.holidays,
                exceptionalDays: schedule.exceptionalDays,
            };

            await api.patch('/configs/delivery-schedule', payload);
            showToast(
                isEn ? 'Delivery schedule saved successfully!' : '¡Cronograma de despacho guardado con éxito!',
                'success'
            );
        } catch (err: any) {
            console.error('Error saving delivery schedule:', err);
            showToast(
                err?.message || (isEn ? 'Failed to save schedule.' : 'Error al guardar el cronograma.'),
                'error'
            );
        } finally {
            setSaving(false);
        }
    };

    // Feriados ordenados
    const sortedHolidays = useMemo(() => {
        return [...schedule.holidays].sort((a, b) => a.date.localeCompare(b.date));
    }, [schedule.holidays]);

    const sortedExceptional = useMemo(() => {
        return [...schedule.exceptionalDays].sort((a, b) => a.date.localeCompare(b.date));
    }, [schedule.exceptionalDays]);

    const dayLabels = isEn ? DAY_NAMES_EN : DAY_NAMES_ES;

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            <AdminSidebar />

            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                {/* Header */}
                <header className="p-6 lg:p-8 border-b border-border bg-card/60 backdrop-blur sticky top-0 z-20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest mb-1">
                            <CalendarDays size={16} />
                            <span>{isEn ? 'Logistics & Dispatch Operations' : 'Operaciones de Logística y Despacho'}</span>
                        </div>
                        <h1 className="text-2xl lg:text-3xl font-black text-foreground tracking-tight">
                            {isEn ? 'Dispatch Schedule & Calendar' : 'Días de Despacho y Calendario'}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {isEn
                                ? 'Configure weekly operating days, official non-working holidays, and special delivery overrides.'
                                : 'Configura los días semanales operativos, días festivos no laborables y excepciones extraordinarias.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchSchedule}
                            disabled={loading || saving}
                            className="px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-semibold text-sm transition-all flex items-center gap-2 disabled:opacity-50"
                            title={isEn ? 'Reload from server' : 'Recargar del servidor'}
                        >
                            <RotateCcw size={16} className={loading ? 'animate-spin' : ''} />
                            <span>{isEn ? 'Refresh' : 'Recargar'}</span>
                        </button>

                        <button
                            onClick={handleSaveSchedule}
                            disabled={saving || loading}
                            className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            <span>{saving ? (isEn ? 'Saving...' : 'Guardando...') : (isEn ? 'Save Changes' : 'Guardar Cambios')}</span>
                        </button>
                    </div>
                </header>

                {/* Toast feedback */}
                {toast && (
                    <div className="px-6 lg:px-8 pt-4">
                        <div
                            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-semibold transition-all ${
                                toast.type === 'success'
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                                    : toast.type === 'error'
                                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
                                    : 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400'
                            }`}
                        >
                            <div className="flex items-center gap-2.5">
                                {toast.type === 'success' && <CheckCircle2 size={18} className="shrink-0" />}
                                {toast.type === 'error' && <AlertCircle size={18} className="shrink-0" />}
                                {toast.type === 'info' && <Info size={18} className="shrink-0" />}
                                <span>{toast.msg}</span>
                            </div>
                            <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100 p-1">
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <main className="p-6 lg:p-8 space-y-8 max-w-7xl">
                    {loading ? (
                        <div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
                            <Loader2 size={36} className="animate-spin text-primary" />
                            <p className="text-sm font-medium">
                                {isEn ? 'Loading dispatch configuration...' : 'Cargando configuración de despacho...'}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* ── SECCIÓN 1: DÍAS FIJOS SEMANALES ─────────────────────────── */}
                            <section className="bg-card border border-border rounded-3xl p-6 lg:p-8 shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-border">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                                <CalendarIcon size={18} />
                                            </div>
                                            <h2 className="text-xl font-black text-foreground">
                                                {isEn ? 'Section 1: Weekly Dispatch Days' : 'Sección 1: Días Fijos Semanales'}
                                            </h2>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {isEn
                                                ? 'Toggle regular delivery days of the week. Customers cannot pick non-operational days unless overridden.'
                                                : 'Activa o desactiva los días regulares de entrega. Los clientes no podrán seleccionar días cerrados.'}
                                        </p>
                                    </div>

                                    {/* Contador visual */}
                                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black tracking-wide">
                                        <Sparkles size={14} />
                                        <span>
                                            {isEn
                                                ? `${schedule.workingDays.length} of 7 operating days selected`
                                                : `${schedule.workingDays.length} de 7 días operativos seleccionados`}
                                        </span>
                                    </div>
                                </div>

                                {/* Matriz interactiva de los 7 días */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                                    {dayLabels.map((dayName, idx) => {
                                        const isOperating = schedule.workingDays.includes(idx);
                                        return (
                                            <button
                                                key={dayName}
                                                type="button"
                                                onClick={() => toggleWorkingDay(idx)}
                                                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-between gap-3 cursor-pointer text-center select-none ${
                                                    isOperating
                                                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-950 dark:text-emerald-100 shadow-sm shadow-emerald-500/10'
                                                        : 'bg-muted/40 border-border text-muted-foreground hover:border-border/80'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <span className="text-[10px] font-black uppercase tracking-wider opacity-60">
                                                        {isEn ? `Day ${idx}` : `Día ${idx}`}
                                                    </span>
                                                    <div
                                                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                                            isOperating
                                                                ? 'bg-emerald-500 text-white'
                                                                : 'bg-muted text-muted-foreground'
                                                        }`}
                                                    >
                                                        {isOperating ? <Check size={12} strokeWidth={3} /> : <X size={12} />}
                                                    </div>
                                                </div>

                                                <div className="my-1">
                                                    <p className="font-black text-base tracking-tight">{dayName}</p>
                                                    <p className={`text-xs font-bold mt-0.5 ${isOperating ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                                        {isOperating
                                                            ? (isEn ? 'OPERATIONAL' : 'OPERATIVO')
                                                            : (isEn ? 'CLOSED' : 'NO OPERATIVO')}
                                                    </p>
                                                </div>

                                                <div
                                                    className={`w-full py-1 rounded-lg text-[10px] font-extrabold tracking-wider uppercase transition-colors ${
                                                        isOperating
                                                            ? 'bg-emerald-500 text-white'
                                                            : 'bg-muted text-muted-foreground'
                                                    }`}
                                                >
                                                    {isOperating ? (isEn ? 'Active' : 'Activo') : (isEn ? 'Inactive' : 'Inactivo')}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            {/* ── SECCIÓN 2: CALENDARIO Y GESTOR DE FESTIVOS (BLACKOUT DATES) ── */}
                            <section className="bg-card border border-border rounded-3xl p-6 lg:p-8 shadow-sm">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
                                                <CalendarX size={18} />
                                            </div>
                                            <h2 className="text-xl font-black text-foreground">
                                                {isEn ? 'Section 2: Non-Working Holidays (Blackout Dates)' : 'Sección 2: Calendario y Gestor de Días Festivos (Blackout Dates)'}
                                            </h2>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {isEn
                                                ? 'Delivery is completely blocked on these dates. The dynamic lead time engine skips them automatically.'
                                                : 'La entrega se bloquea totalmente en estas fechas. El motor dinámico de despacho las salta automáticamente.'}
                                        </p>
                                    </div>

                                    {/* Botón 1-clic carga oficial NY/US */}
                                    <button
                                        type="button"
                                        onClick={handleLoadOfficialHolidays}
                                        className="px-4 py-2.5 rounded-xl border border-border bg-gradient-to-r from-blue-500/10 via-rose-500/10 to-amber-500/10 hover:from-blue-500/20 hover:to-rose-500/20 text-foreground font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shrink-0"
                                    >
                                        <Flag size={14} className="text-rose-500" />
                                        <span>{isEn ? '🇺🇸 Load Official NY/US Holidays' : '🇺🇸 Cargar Feriados Oficiales NY/US'}</span>
                                    </button>
                                </div>

                                {/* Formulario para agregar festivo individual */}
                                <form onSubmit={handleAddHoliday} className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-6 p-4 rounded-2xl bg-muted/30 border border-border">
                                    <div className="sm:col-span-4">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
                                            {isEn ? 'Holiday Date:' : 'Fecha del Festivo:'}
                                        </label>
                                        <input
                                            type="date"
                                            value={newHolidayDate}
                                            onChange={e => setNewHolidayDate(e.target.value)}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-foreground font-semibold text-sm outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>

                                    <div className="sm:col-span-6">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
                                            {isEn ? 'Holiday Name / Reason:' : 'Nombre del Feriado / Motivo:'}
                                        </label>
                                        <input
                                            type="text"
                                            placeholder={isEn ? 'e.g. Thanksgiving Day' : 'ej. Día de Acción de Gracias'}
                                            value={newHolidayName}
                                            onChange={e => setNewHolidayName(e.target.value)}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-foreground font-semibold text-sm outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>

                                    <div className="sm:col-span-2 flex items-end">
                                        <button
                                            type="submit"
                                            className="w-full px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer h-[42px]"
                                        >
                                            <Plus size={16} />
                                            <span>{isEn ? 'Add Holiday' : 'Agregar Festivo'}</span>
                                        </button>
                                    </div>
                                </form>

                                {/* Lista/Tabla de feriados registrados */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-2">
                                        <span>{isEn ? `Registered Holidays (${sortedHolidays.length})` : `Feriados Registrados (${sortedHolidays.length})`}</span>
                                        <span>{isEn ? 'Sorted chronologically' : 'Orden cronológico'}</span>
                                    </div>

                                    {sortedHolidays.length === 0 ? (
                                        <div className="p-8 text-center border border-dashed border-border rounded-2xl text-muted-foreground text-xs">
                                            {isEn ? 'No blackout holidays registered.' : 'No hay días festivos registrados actualmente.'}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1">
                                            {sortedHolidays.map(holiday => (
                                                <div
                                                    key={holiday.date}
                                                    className="p-3.5 rounded-2xl border border-rose-500/20 bg-rose-500/5 flex items-center justify-between gap-3 group hover:border-rose-500/40 transition-all"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2 py-0.5 rounded-md bg-rose-500 text-white font-mono font-bold text-[10px]">
                                                                {holiday.date}
                                                            </span>
                                                            <span className="text-[11px] text-muted-foreground font-medium truncate">
                                                                {formatDeliveryDatePretty(holiday.date, locale as any)}
                                                            </span>
                                                        </div>
                                                        <p className="font-bold text-sm text-foreground mt-1 truncate" title={holiday.name}>
                                                            {holiday.name}
                                                        </p>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveHoliday(holiday.date)}
                                                        className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/20 transition-colors shrink-0 cursor-pointer"
                                                        title={isEn ? 'Delete holiday' : 'Eliminar festivo'}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* ── SECCIÓN 3: DÍAS EXTRAORDINARIOS DE DESPACHO (ONE-TIME OVERRIDES) ── */}
                            <section className="bg-card border border-border rounded-3xl p-6 lg:p-8 shadow-sm">
                                <div className="mb-6 pb-4 border-b border-border">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                                            <CalendarCheck size={18} />
                                        </div>
                                        <h2 className="text-xl font-black text-foreground">
                                            {isEn ? 'Section 3: Extraordinary Dispatch Days (One-Time Overrides)' : 'Sección 3: Días Extraordinarios de Despacho (One-Time Overrides)'}
                                        </h2>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {isEn
                                            ? 'Enable delivery on a specific date normally marked as non-operational (e.g. holiday eve rush or special baker event).'
                                            : 'Habilita entregas en una fecha específica que normalmente estaría inactiva (ej. víspera de festivo o temporada especial).'}
                                    </p>
                                </div>

                                {/* Formulario para agregar día extraordinario */}
                                <form onSubmit={handleAddExceptionalDay} className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-6 p-4 rounded-2xl bg-muted/30 border border-border">
                                    <div className="sm:col-span-4">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
                                            {isEn ? 'Special Date:' : 'Fecha Especial:'}
                                        </label>
                                        <input
                                            type="date"
                                            value={newExceptionalDate}
                                            onChange={e => setNewExceptionalDate(e.target.value)}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-foreground font-semibold text-sm outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>

                                    <div className="sm:col-span-6">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
                                            {isEn ? 'Reason / Event Description:' : 'Motivo / Evento Especial:'}
                                        </label>
                                        <input
                                            type="text"
                                            placeholder={isEn ? 'e.g. Thanksgiving Eve Special Run' : 'ej. Despacho Extra Víspera de Acción de Gracias'}
                                            value={newExceptionalName}
                                            onChange={e => setNewExceptionalName(e.target.value)}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-foreground font-semibold text-sm outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>

                                    <div className="sm:col-span-2 flex items-end">
                                        <button
                                            type="submit"
                                            className="w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer h-[42px]"
                                        >
                                            <Plus size={16} />
                                            <span>{isEn ? 'Enable Override' : 'Habilitar Fecha'}</span>
                                        </button>
                                    </div>
                                </form>

                                {/* Lista de días extraordinarios */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-2">
                                        <span>{isEn ? `Active Special Overrides (${sortedExceptional.length})` : `Fechas Especiales Activas (${sortedExceptional.length})`}</span>
                                    </div>

                                    {sortedExceptional.length === 0 ? (
                                        <div className="p-8 text-center border border-dashed border-border rounded-2xl text-muted-foreground text-xs">
                                            {isEn ? 'No extraordinary delivery overrides active.' : 'No hay días extraordinarios configurados actualmente.'}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-1">
                                            {sortedExceptional.map(item => (
                                                <div
                                                    key={item.date}
                                                    className="p-3.5 rounded-2xl border border-blue-500/20 bg-blue-500/5 flex items-center justify-between gap-3 group hover:border-blue-500/40 transition-all"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-mono font-bold text-[10px]">
                                                                {item.date}
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-[9px] uppercase tracking-wider">
                                                                {isEn ? 'OVERRIDE' : 'EXCEPCIÓN'}
                                                            </span>
                                                        </div>
                                                        <p className="font-bold text-sm text-foreground mt-1 truncate" title={item.name}>
                                                            {item.name}
                                                        </p>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveExceptionalDay(item.date)}
                                                        className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/20 transition-colors shrink-0 cursor-pointer"
                                                        title={isEn ? 'Delete override' : 'Eliminar excepción'}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </section>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}
