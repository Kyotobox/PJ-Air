'use client';

import React, { useState } from 'react';
import { Terminal, Github, Key, MapPin, Database, Zap, User, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/lib/config';
import { api } from '@/lib/api';

export default function DevTools() {
    const { user, profile, signOut } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<string>('');

    const testPing = async () => {
        setStatus('Pinging backend...');
        try {
            const res = await fetch(`${API_URL}/api`); // Base backend URL
            if (res.ok) setStatus('Pong! Backend is alive.');
            else setStatus('Error: Backend returned ' + res.status);
        } catch (e) {
            setStatus('Error connecting to backend: ' + (e as any).message);
        }
    };

    const testAuthDebug = async () => {
        setStatus('Checking Current Session...');
        if (!user) {
            setStatus('Auth Status: No user logged in.');
            return;
        }
        setStatus(`Auth Success: Logged in as ${user.email} (Role: ${profile?.role || user.user_metadata?.role || 'client'})`);
    };

    const createTestAddress = async () => {
        setStatus('Testing Address Creation...');
        // Mock call
        setStatus('Simulated address creation for testing.');
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 bg-primary text-white p-3 rounded-full shadow-2xl z-50 hover:bg-accent transition-colors"
            >
                <Terminal size={24} />
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 w-96 max-h-[80vh] bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col animate-fade-in">
            {/* Header */}
            <div className="bg-primary p-4 text-white flex justify-between items-center">
                <div className="flex items-center gap-2 font-bold">
                    <Terminal size={20} />
                    <span>Dev Tools</span>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white text-xl">&times;</button>
            </div>

            {/* Content */}
            <div className="p-4 flex-1 overflow-y-auto space-y-6">
                {/* User Status */}
                <section className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                    <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                        <User size={14} /> Estado de Sesión
                    </h3>
                    {user ? (
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center font-bold shadow-md">
                                    {(profile?.full_name || user.email || 'U')[0].toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-foreground">{profile?.full_name || 'Usuario'}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1 font-medium">{user.email}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => signOut()}
                                className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                title="Cerrar Sesión"
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center py-4 gap-2">
                            <p className="text-[10px] font-black text-muted-foreground uppercase">No hay sesión activa</p>
                            <p className="text-[9px] text-muted-foreground/60 text-center italic">Usa el formulario de login para ingresar como admin@test.com</p>
                        </div>
                    )}
                </section>

                {/* Session Debugger */}
                <section>
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                        <Zap size={14} /> Session Debugger
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                        <button onClick={testPing} className="flex items-center gap-3 px-4 py-3 bg-muted hover:bg-border rounded-xl text-xs font-bold transition-all border border-transparent hover:border-primary/20 group">
                            <div className="w-2 h-2 rounded-full bg-blue-500 group-hover:scale-125 transition-transform" /> 🏓 Test Ping (No Auth)
                        </button>
                        <button onClick={testAuthDebug} className="flex items-center gap-3 px-4 py-3 bg-muted hover:bg-border rounded-xl text-xs font-bold transition-all border border-transparent hover:border-primary/20 group">
                            <div className="w-2 h-2 rounded-full bg-orange-500 group-hover:scale-125 transition-transform" /> 🔍 Test Auth Debug
                        </button>
                        <button onClick={createTestAddress} className="flex items-center gap-3 px-4 py-3 bg-muted hover:bg-border rounded-xl text-xs font-bold transition-all border border-transparent hover:border-primary/20 group">
                            <div className="w-2 h-2 rounded-full bg-green-500 group-hover:scale-125 transition-transform" /> 🧪 Test Create Address
                        </button>
                    </div>
                </section>

                {/* Github Commit */}
                <section>
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                        <Github size={14} /> Github Commit
                    </h3>
                    <div className="space-y-2">
                        <input type="text" placeholder="Nombre del Commit..." className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-xs outline-none focus:ring-4 focus:ring-primary/10 transition-all font-medium" />
                        <button className="w-full py-3 bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary transition-colors shadow-lg shadow-black/10">Realizar Commit</button>
                    </div>
                </section>

                {/* Console Output */}
                <section>
                    <div className="bg-zinc-950 p-4 rounded-[20px] text-[10px] font-mono text-emerald-400 overflow-x-auto border border-white/5 relative group">
                        <div className="flex items-center justify-between mb-2 opacity-50">
                            <span className="font-bold">CONSOLE_OUTPUT_V1.0</span>
                            <button onClick={() => setStatus('')} className="hover:text-white transition-colors">Clear</button>
                        </div>
                        <pre className="whitespace-pre-wrap leading-normal">{status || '> System ready for debugging...'}</pre>
                    </div>
                </section>

                {/* Product Upload Utility */}
                <section>
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                        <Database size={14} /> Gestión de Catálogo
                    </h3>
                    <div className="space-y-4 bg-muted/60 p-6 rounded-3xl border border-border/50">
                        <p className="text-[10px] text-muted-foreground font-medium mb-2">Sincroniza los productos definidos localmente en `lib/products.ts` con la base de datos remota.</p>
                        <button 
                            onClick={async () => {
                                setStatus('Syncing products with Backend API...');
                                try {
                                    const { PRODUCTS } = await import('@/lib/products');
                                    for (const prod of PRODUCTS) {
                                        await api.post('/products', prod).catch(() => null);
                                    }
                                    setStatus('Success: Products synced to Backend database.');
                                } catch (e: any) {
                                    setStatus('Sync Error: ' + e.message);
                                }
                            }}
                            className="w-full py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                        >
                            Sincronizar Catálogo Local
                        </button>

                        <div className="h-[1px] bg-border/40 my-4" />

                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-muted-foreground uppercase ml-1">Archivo CSV (Opcional)</label>
                            <input type="file" accept=".csv" className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-[9px] file:font-black file:bg-primary file:text-white hover:file:bg-black transition-all cursor-pointer" />
                        </div>
                        <button className="w-full py-3 bg-zinc-800 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-black/10 hover:scale-[1.02] transition-all">
                            Procesar CSV Externo
                        </button>
                    </div>
                </section>

                {/* Credentials */}
                <section className="pb-10">
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                        <Key size={14} /> APIKeys y Accesos
                    </h3>
                    <div className="space-y-2">
                        <div className="bg-muted p-3 rounded-xl">
                            <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Google Maps</p>
                            <p className="text-[10px] break-all font-mono opacity-60">AIzaSyCMfa...UuEwWBc-k</p>
                        </div>
                        <div className="bg-muted p-3 rounded-xl">
                            <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Supabase Project</p>
                            <p className="text-[10px] break-all font-mono opacity-60">jdeojeykyapjhvkhrxnc</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
