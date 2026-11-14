'use client';

import React, { useState, useEffect, useMemo } from 'react';
import AdminSidebar from '@/components/layout/AdminSidebar';
import { 
    ShoppingBag, Search, Plus, Minus, Trash2, ArrowLeft,
    CheckCircle2, AlertCircle, Building2, MapPin, Phone,
    Mail, DollarSign, Calendar, Clock, ShieldCheck,
    CreditCard, Banknote, FileText, Check, Loader2, Sparkles, AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface ProductItem {
    id: number;
    name: string;
    price: string | number;
    category?: { id: number; name: string } | string;
    image?: string;
    is_active?: boolean;
}

interface UserAddress {
    id: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    is_default?: boolean;
}

interface ClientUser {
    id: string;
    email: string;
    account_type?: string;
    account_status?: string;
    credit_limit?: number;
    delivery_fee?: number;
    free_delivery_enabled?: boolean;
    zelle_enabled?: boolean;
    general_discount?: number;
    tax_exempt?: boolean;
    tax_id?: string;
    profile?: {
        full_name?: string;
        business_name?: string;
        dba?: string;
        phone?: string;
        tax_id?: string;
        tax_exempt?: boolean;
    };
    addresses?: UserAddress[];
}

interface OrderLineItem {
    product: ProductItem;
    quantity: number;
    unitPrice: number;
    isCustomPrice: boolean;
}

export default function NewManualOrderPage() {
    const router = useRouter();

    // Data lists
    const [clients, setClients] = useState<ClientUser[]>([]);
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    // Selected Client
    const [clientSearch, setClientSearch] = useState('');
    const [selectedClient, setSelectedClient] = useState<ClientUser | null>(null);

    // Order items
    const [orderItems, setOrderItems] = useState<OrderLineItem[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    // Delivery & Schedule
    const [deliveryType, setDeliveryType] = useState<'saved' | 'pickup' | 'other'>('saved');
    const [selectedAddressId, setSelectedAddressId] = useState<string>('');
    const [customAddressText, setCustomAddressText] = useState('');
    const [deliveryDate, setDeliveryDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 2); // Default T+2
        return d.toISOString().split('T')[0];
    });
    const [adminOverrideCutoff, setAdminOverrideCutoff] = useState(false);
    const [deliveryFee, setDeliveryFee] = useState<number>(0);

    // Financials & Payment Terms
    const [discountPercentage, setDiscountPercentage] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState<'credit' | 'cash' | 'check' | 'ach' | 'stripe'>('credit');
    const [checkNumber, setCheckNumber] = useState('');
    const [checkBank, setCheckBank] = useState('');
    const [wireReference, setWireReference] = useState('');
    const [orderNotes, setOrderNotes] = useState('');

    // Submission status
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Load clients and products
    useEffect(() => {
        async function loadInitialData() {
            try {
                setLoadingData(true);
                const [usersRes, productsRes] = await Promise.all([
                    api.get('/users') as Promise<ClientUser[]>,
                    api.get('/products') as Promise<ProductItem[]>
                ]);
                // Filter users to approved active users
                const approvedClients = Array.isArray(usersRes) 
                    ? usersRes.filter(u => u.account_status !== 'REJECTED')
                    : [];
                setClients(approvedClients);

                const activeProducts = Array.isArray(productsRes)
                    ? productsRes.filter(p => p.is_active !== false)
                    : [];
                setProducts(activeProducts);
            } catch (err: any) {
                console.error('Error fetching admin order data:', err);
                setErrorMsg('Error al cargar la lista de clientes o productos.');
            } finally {
                setLoadingData(false);
            }
        }
        loadInitialData();
    }, []);

    // When client changes, auto-populate terms
    const handleSelectClient = (client: ClientUser) => {
        setSelectedClient(client);
        setClientSearch('');

        // Preload default address
        if (client.addresses && client.addresses.length > 0) {
            const defAddr = client.addresses.find(a => a.is_default) || client.addresses[0];
            setSelectedAddressId(defAddr.id);
            setDeliveryType('saved');
        } else {
            setSelectedAddressId('');
            setDeliveryType('pickup');
        }

        // Preload delivery fee (TASK-94-02: $0 si el cliente tiene flete gratis permanente)
        const assignedFee = client.free_delivery_enabled ? 0 : Number(client.delivery_fee || 0);
        setDeliveryFee(assignedFee);

        // Preload discount
        const clientDiscount = Number(client.general_discount || 0);
        setDiscountPercentage(clientDiscount);

        // Preload payment method based on account type
        if (client.account_type === 'credit') {
            setPaymentMethod('credit');
        } else {
            setPaymentMethod('cash');
        }
    };

    // Filter clients for typeahead
    const filteredClients = useMemo(() => {
        if (!clientSearch.trim()) return [];
        const q = clientSearch.toLowerCase();
        return clients.filter(c => {
            const name = c.profile?.full_name?.toLowerCase() || '';
            const bName = c.profile?.business_name?.toLowerCase() || '';
            const dba = c.profile?.dba?.toLowerCase() || '';
            const email = c.email.toLowerCase();
            const phone = c.profile?.phone || '';
            return name.includes(q) || bName.includes(q) || dba.includes(q) || email.includes(q) || phone.includes(q);
        }).slice(0, 8);
    }, [clients, clientSearch]);

    // Categories available
    const categories = useMemo(() => {
        const set = new Set<string>();
        products.forEach(p => {
            if (typeof p.category === 'string') set.add(p.category);
            else if (p.category && typeof p.category === 'object' && p.category.name) set.add(p.category.name);
        });
        return Array.from(set);
    }, [products]);

    // Filter products
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = !productSearch.trim() || p.name.toLowerCase().includes(productSearch.toLowerCase());
            const catName = typeof p.category === 'string' ? p.category : p.category?.name || '';
            const matchesCat = selectedCategory === 'all' || catName === selectedCategory;
            return matchesSearch && matchesCat;
        });
    }, [products, productSearch, selectedCategory]);

    // Add product to cart
    const handleAddProduct = (product: ProductItem) => {
        setOrderItems(prev => {
            const existingIdx = prev.findIndex(item => item.product.id === product.id);
            if (existingIdx >= 0) {
                const next = [...prev];
                next[existingIdx].quantity += 1;
                return next;
            }
            const basePrice = Number(product.price) || 0;
            return [...prev, {
                product,
                quantity: 1,
                unitPrice: basePrice,
                isCustomPrice: false
            }];
        });
    };

    // Update quantity
    const handleUpdateQuantity = (productId: number, qty: number) => {
        if (qty <= 0) {
            handleRemoveProduct(productId);
            return;
        }
        setOrderItems(prev => prev.map(item => 
            item.product.id === productId ? { ...item, quantity: qty } : item
        ));
    };

    // Update custom unit price
    const handleUpdateCustomPrice = (productId: number, priceStr: string) => {
        const parsed = parseFloat(priceStr);
        setOrderItems(prev => prev.map(item => {
            if (item.product.id !== productId) return item;
            if (isNaN(parsed) || parsed < 0) {
                return { ...item, isCustomPrice: false };
            }
            return {
                ...item,
                unitPrice: parsed,
                isCustomPrice: true
            };
        }));
    };

    // Remove product
    const handleRemoveProduct = (productId: number) => {
        setOrderItems(prev => prev.filter(item => item.product.id !== productId));
    };

    // Calculations
    const itemsSubtotal = useMemo(() => {
        return orderItems.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
    }, [orderItems]);

    const discountAmount = useMemo(() => {
        if (discountPercentage <= 0) return 0;
        return Math.round(itemsSubtotal * (Math.min(discountPercentage, 50) / 100) * 100) / 100;
    }, [itemsSubtotal, discountPercentage]);

    const isTaxExempt = useMemo(() => {
        return Boolean(selectedClient?.tax_exempt || selectedClient?.profile?.tax_exempt);
    }, [selectedClient]);

    const salesTaxAmount = useMemo(() => {
        if (isTaxExempt) return 0;
        // Default NY State 8.875% tax if not exempt
        const taxable = Math.max(0, itemsSubtotal - discountAmount);
        return Math.round(taxable * 0.08875 * 100) / 100;
    }, [itemsSubtotal, discountAmount, isTaxExempt]);

    const effectiveDeliveryFee = deliveryType === 'pickup' ? 0 : Math.min(Math.max(0, Number(deliveryFee) || 0), 1500);

    const grandTotal = useMemo(() => {
        return Math.max(0, Math.round((itemsSubtotal - discountAmount + effectiveDeliveryFee + salesTaxAmount + Number.EPSILON) * 100) / 100);
    }, [itemsSubtotal, discountAmount, effectiveDeliveryFee, salesTaxAmount]);

    // Submit Order
    const handleSubmitOrder = async (isDraftMode: boolean) => {
        setErrorMsg(null);
        setSuccessMsg(null);

        if (!selectedClient) {
            setErrorMsg('Por favor selecciona un cliente para el pedido.');
            return;
        }

        if (orderItems.length === 0) {
            setErrorMsg('Agrega al menos un producto a la orden.');
            return;
        }

        if (!deliveryDate) {
            setErrorMsg('La fecha de entrega es obligatoria.');
            return;
        }

        if (deliveryType === 'saved' && !selectedAddressId) {
            setErrorMsg('Selecciona una dirección de entrega guardada o cambia a recogida en planta.');
            return;
        }

        if (deliveryType === 'other' && !customAddressText.trim()) {
            setErrorMsg('Ingresa el texto de la dirección personalizada.');
            return;
        }

        setSubmitting(true);

        try {
            // Check if any price override is active
            const hasCustomPrices = orderItems.some(i => i.isCustomPrice);

            const payload: any = {
                userId: selectedClient.id,
                manual_entry: true,
                admin_created: true,
                is_draft: isDraftMode,
                status: isDraftMode ? 'draft' : 'confirmed',
                admin_override_cutoff: adminOverrideCutoff,
                override_prices: hasCustomPrices,
                deliveryDate,
                deliveryType,
                addressId: deliveryType === 'saved' ? selectedAddressId : undefined,
                deliveryAddressText: deliveryType === 'other' ? customAddressText.trim() : undefined,
                delivery_fee_charged: effectiveDeliveryFee,
                discount_percentage: discountPercentage,
                paymentMethod,
                check_number: paymentMethod === 'check' ? checkNumber.trim() || undefined : undefined,
                check_bank: paymentMethod === 'check' ? checkBank.trim() || undefined : undefined,
                wire_reference: paymentMethod === 'ach' ? wireReference.trim() || undefined : undefined,
                notes: orderNotes.trim() ? orderNotes.trim() : undefined,
                items: orderItems.map(item => ({
                    productId: item.product.id,
                    quantity: item.quantity,
                    price_at_time: item.unitPrice
                }))
            };

            const createdOrder = await api.post('/orders', payload) as any;

            setSuccessMsg(
                isDraftMode 
                    ? `Borrador guardado exitosamente (ID: ${createdOrder?.id?.slice(0, 8)}).`
                    : `Pedido manual creado y facturado exitosamente (${createdOrder?.invoice_number || 'Confirmado'}).`
            );

            // Redirect back to orders dashboard after 1.5s
            setTimeout(() => {
                router.push('/admin/orders');
            }, 1500);

        } catch (err: any) {
            console.error('Error creating manual order:', err);
            const serverMessage = err?.response?.data?.message || err?.message || 'Error al procesar el pedido manual.';
            setErrorMsg(Array.isArray(serverMessage) ? serverMessage.join(', ') : serverMessage);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
            <AdminSidebar />
            <main className="flex-1 p-6 md:p-8 overflow-auto max-w-7xl mx-auto">
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Link 
                                href="/admin/orders" 
                                className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                            >
                                <ArrowLeft size={14} /> Volver a Pedidos
                            </Link>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <ShoppingBag className="text-amber-600" /> Nuevo Pedido Manual B2B
                        </h1>
                        <p className="text-sm text-slate-500 font-medium">
                            Ingreso directo de órdenes telefónicas, bypass de corte 12 PM y tarifas especiales de flete.
                        </p>
                    </div>
                </header>

                {/* Notifications */}
                {errorMsg && (
                    <div data-testid="alert-error" className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center gap-3">
                        <AlertCircle className="text-rose-600 shrink-0" size={20} />
                        <span>{errorMsg}</span>
                    </div>
                )}
                {successMsg && (
                    <div data-testid="alert-success" className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-3">
                        <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />
                        <span>{successMsg}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Form & Products (8 Cols) */}
                    <div className="lg:col-span-8 space-y-6">
                        
                        {/* 1. Client Selection Card */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                            <h2 className="text-lg font-black text-slate-900 mb-3 flex items-center gap-2">
                                <Building2 className="text-amber-600" size={20} /> 1. Cliente Mayorista B2B
                            </h2>

                            {!selectedClient ? (
                                <div className="relative">
                                    <div className="relative">
                                        <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                                        <input
                                            type="text"
                                            data-testid="input-client-search"
                                            value={clientSearch}
                                            onChange={(e) => setClientSearch(e.target.value)}
                                            placeholder="Buscar por DBA, Razón Social, Teléfono o Email..."
                                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                                        />
                                    </div>

                                    {/* Typeahead Suggestions */}
                                    {filteredClients.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-30">
                                            {filteredClients.map((c) => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    data-testid={`client-option-${c.id}`}
                                                    onClick={() => handleSelectClient(c)}
                                                    className="w-full px-4 py-3 text-left hover:bg-amber-50/60 border-b border-slate-100 last:border-0 transition-colors flex items-center justify-between group"
                                                >
                                                    <div>
                                                        <div className="font-bold text-slate-900 group-hover:text-amber-800 text-sm">
                                                            {c.profile?.dba || c.profile?.business_name || c.profile?.full_name || 'Cliente sin nombre'}
                                                        </div>
                                                        <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                                                            <span>{c.email}</span>
                                                            {c.profile?.phone && <span>• {c.profile.phone}</span>}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        {c.account_type === 'credit' && (
                                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-lg border border-blue-200">
                                                                Crédito B2B
                                                            </span>
                                                        )}
                                                        {(c.tax_exempt || c.profile?.tax_exempt) && (
                                                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-lg border border-emerald-200">
                                                                ST-120
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-200/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-base font-black text-slate-900">
                                                {selectedClient.profile?.dba || selectedClient.profile?.business_name || selectedClient.profile?.full_name}
                                            </span>
                                            {selectedClient.account_type === 'credit' ? (
                                                <span className="px-2.5 py-0.5 text-xs font-black bg-blue-100 text-blue-800 rounded-lg">
                                                    Crédito Net 15
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-0.5 text-xs font-black bg-slate-100 text-slate-700 rounded-lg">
                                                    Contado / Prepago
                                                </span>
                                            )}
                                            {isTaxExempt && (
                                                <span className="px-2.5 py-0.5 text-xs font-black bg-emerald-100 text-emerald-800 rounded-lg flex items-center gap-1">
                                                    <ShieldCheck size={12} /> Exento ST-120
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-4">
                                            <span className="flex items-center gap-1"><Mail size={12} /> {selectedClient.email}</span>
                                            {selectedClient.profile?.phone && (
                                                <span className="flex items-center gap-1"><Phone size={12} /> {selectedClient.profile.phone}</span>
                                            )}
                                            {selectedClient.delivery_fee && Number(selectedClient.delivery_fee) > 0 ? (
                                                <span className="text-amber-800 font-bold">Flete Asignado: ${Number(selectedClient.delivery_fee).toFixed(2)}</span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedClient(null)}
                                        className="text-xs font-bold text-rose-600 hover:text-rose-800 underline transition-colors"
                                    >
                                        Cambiar cliente
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 2. Logistics & Delivery Options */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <Calendar className="text-amber-600" size={20} /> 2. Logística y Fecha de Entrega
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Delivery Date */}
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                                        Fecha de Entrega
                                    </label>
                                    <input
                                        type="date"
                                        data-testid="input-delivery-date"
                                        value={deliveryDate}
                                        onChange={(e) => setDeliveryDate(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                    />
                                </div>

                                {/* Delivery Type */}
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                                        Tipo de Entrega
                                    </label>
                                    <select
                                        data-testid="select-delivery-type"
                                        value={deliveryType}
                                        onChange={(e) => setDeliveryType(e.target.value as any)}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                    >
                                        <option value="saved">Dirección Guardada del Cliente</option>
                                        <option value="pickup">Recogida en Planta (Pickup $0)</option>
                                        <option value="other">Dirección Ad-hoc / Ruta Larga Distancia (ej. Boston)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Saved Address Dropdown */}
                            {deliveryType === 'saved' && selectedClient && (
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                                        Dirección Registrada
                                    </label>
                                    {selectedClient.addresses && selectedClient.addresses.length > 0 ? (
                                        <select
                                            data-testid="select-address-id"
                                            value={selectedAddressId}
                                            onChange={(e) => setSelectedAddressId(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                        >
                                            {selectedClient.addresses.map(addr => (
                                                <option key={addr.id} value={addr.id}>
                                                    {addr.address}, {addr.city}, {addr.state} {addr.zip} {addr.is_default ? '(Predeterminada)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="text-xs text-amber-800 font-medium bg-amber-50 p-3 rounded-xl border border-amber-200">
                                            Este cliente no tiene direcciones registradas. Se recomienda entrega ad-hoc o recogida en planta.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Other / Ad-hoc Address Text */}
                            {deliveryType === 'other' && (
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                                        Dirección Completa de Destino
                                    </label>
                                    <input
                                        type="text"
                                        data-testid="input-custom-address"
                                        value={customAddressText}
                                        onChange={(e) => setCustomAddressText(e.target.value)}
                                        placeholder="ej. 150 Broadway, Somerville, MA 02145"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                    />
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        Soporta rutas multi-estatales extendidas (NY, NJ, CT, MA, RI, PA, etc.).
                                    </p>
                                </div>
                            )}

                            {/* Cutoff Override Toggle & Delivery Fee Override */}
                            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                {/* Cutoff Toggle */}
                                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                                    <div>
                                        <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                                            <Sparkles size={14} className="text-amber-600" /> Bypass Corte 12 PM
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                            Permite entrega hoy/mañana aprobada con cocina
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            data-testid="toggle-bypass-cutoff"
                                            checked={adminOverrideCutoff}
                                            onChange={(e) => setAdminOverrideCutoff(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                                    </label>
                                </div>

                                {/* Manual Delivery Fee */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
                                            Tarifa de Flete / Entrega ($)
                                        </label>
                                        {deliveryType !== 'pickup' && (
                                            <button
                                                type="button"
                                                onClick={() => setDeliveryFee(0)}
                                                className="text-[10px] font-black text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded-lg border border-teal-200 uppercase tracking-wider transition-all"
                                                title="Exonerar costo de flete para este pedido"
                                            >
                                                Exonerar ($0.00)
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="1500"
                                            data-testid="input-manual-delivery-fee"
                                            disabled={deliveryType === 'pickup'}
                                            value={deliveryType === 'pickup' ? 0 : deliveryFee}
                                            onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                                            className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:opacity-50"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Products Picker & Added Items */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                    <ShoppingBag className="text-amber-600" size={20} /> 3. Ítems del Pedido ({orderItems.length})
                                </h2>
                                
                                {/* Catalog Category Filter & Search */}
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <select
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                                    >
                                        <option value="all">Todas las categorías</option>
                                        {categories.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                    <div className="relative flex-1 sm:w-48">
                                        <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
                                        <input
                                            type="text"
                                            placeholder="Buscar producto..."
                                            value={productSearch}
                                            onChange={(e) => setProductSearch(e.target.value)}
                                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Quick Product Add Row */}
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                                {filteredProducts.slice(0, 10).map(p => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        data-testid={`btn-quick-add-${p.id}`}
                                        onClick={() => handleAddProduct(p)}
                                        className="px-3 py-2 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl text-xs font-bold text-slate-800 transition-all flex items-center gap-2 shrink-0 group"
                                    >
                                        <Plus size={14} className="text-amber-600 group-hover:scale-125 transition-transform" />
                                        <span>{p.name}</span>
                                        <span className="text-slate-500 font-semibold">${Number(p.price).toFixed(2)}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Added Items Table */}
                            {orderItems.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-sm font-medium border border-dashed border-slate-200 rounded-2xl">
                                    No hay productos añadidos a la orden. Selecciona productos arriba.
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                                    {orderItems.map((item) => (
                                        <div key={item.product.id} data-testid={`order-item-row-${item.product.id}`} className="p-3 sm:p-4 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                                            <div className="flex-1">
                                                <div className="font-bold text-sm text-slate-900">{item.product.name}</div>
                                                <div className="text-xs text-slate-400">
                                                    Catálogo base: ${Number(item.product.price).toFixed(2)}
                                                </div>
                                            </div>

                                            {/* Quantity Stepper */}
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    data-testid={`btn-qty-minus-${item.product.id}`}
                                                    onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                                                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-black transition-colors"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <span data-testid={`qty-val-${item.product.id}`} className="w-8 text-center font-black text-sm text-slate-900">
                                                    {item.quantity}
                                                </span>
                                                <button
                                                    type="button"
                                                    data-testid={`btn-qty-plus-${item.product.id}`}
                                                    onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                                                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-black transition-colors"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>

                                            {/* Custom Price Input */}
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs text-slate-400 font-bold">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    data-testid={`input-custom-price-${item.product.id}`}
                                                    value={item.unitPrice}
                                                    onChange={(e) => handleUpdateCustomPrice(item.product.id, e.target.value)}
                                                    className={`w-20 px-2 py-1 text-sm font-bold rounded-lg border text-right focus:outline-none ${
                                                        item.isCustomPrice 
                                                            ? 'border-amber-400 bg-amber-50 text-amber-900 font-black' 
                                                            : 'border-slate-200 bg-slate-50 text-slate-800'
                                                    }`}
                                                />
                                                <span className="text-[11px] text-slate-400">c/u</span>
                                            </div>

                                            {/* Line Total */}
                                            <div className="w-20 text-right font-black text-sm text-slate-900">
                                                ${(item.unitPrice * item.quantity).toFixed(2)}
                                            </div>

                                            {/* Remove Button */}
                                            <button
                                                type="button"
                                                data-testid={`btn-remove-item-${item.product.id}`}
                                                onClick={() => handleRemoveProduct(item.product.id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 4. Notes & Delivery Instructions */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                                Notas Internas / Instrucciones para Cocina y Chofer
                            </label>
                            <textarea
                                data-testid="input-order-notes"
                                value={orderNotes}
                                onChange={(e) => setOrderNotes(e.target.value)}
                                rows={2}
                                placeholder="ej. Entregar por la puerta trasera antes de las 9:00 AM..."
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            />
                        </div>
                    </div>

                    {/* Right Column: Financial Summary & Actions (4 Cols) */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm sticky top-6 space-y-6">
                            <h2 className="text-lg font-black text-slate-900 pb-3 border-b border-slate-100 flex items-center justify-between">
                                <span>Resumen Financiero</span>
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">B2B</span>
                            </h2>

                            {/* Payment Method Selector */}
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                                    Método de Pago
                                </label>
                                <select
                                    data-testid="select-payment-method"
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                >
                                    <option value="credit">Crédito Comercial (Net 15)</option>
                                    <option value="cash">Efectivo contra Entrega</option>
                                    <option value="check">Cheque Comercial</option>
                                    <option value="ach">Transferencia ACH / Wire</option>
                                    <option value="stripe">Tarjeta de Crédito / Stripe</option>
                                </select>

                                {/* Check details */}
                                {paymentMethod === 'check' && (
                                    <div className="mt-3 space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                                        <input
                                            type="text"
                                            data-testid="input-check-number"
                                            placeholder="N° de Cheque (ej. 1042)"
                                            value={checkNumber}
                                            onChange={(e) => setCheckNumber(e.target.value)}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                                        />
                                        <input
                                            type="text"
                                            data-testid="input-check-bank"
                                            placeholder="Banco Emisor (ej. Chase, BoA)"
                                            value={checkBank}
                                            onChange={(e) => setCheckBank(e.target.value)}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                )}

                                {/* Wire/ACH details */}
                                {paymentMethod === 'ach' && (
                                    <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                                        <input
                                            type="text"
                                            data-testid="input-wire-reference"
                                            placeholder="Referencia de Transferencia / Wire"
                                            value={wireReference}
                                            onChange={(e) => setWireReference(e.target.value)}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Breakdown Rows */}
                            <div className="space-y-2.5 text-sm pt-2 border-t border-slate-100">
                                <div className="flex justify-between text-slate-600 font-medium">
                                    <span>Subtotal Productos:</span>
                                    <span className="font-bold text-slate-900">${itemsSubtotal.toFixed(2)}</span>
                                </div>

                                {/* General Discount */}
                                <div className="flex justify-between items-center text-slate-600 font-medium">
                                    <span className="flex items-center gap-1">
                                        Descuento (%):
                                        <input
                                            type="number"
                                            min="0"
                                            max="50"
                                            data-testid="input-discount-pct"
                                            value={discountPercentage}
                                            onChange={(e) => setDiscountPercentage(parseFloat(e.target.value) || 0)}
                                            className="w-12 px-1 py-0.5 text-xs font-black text-right border border-slate-200 rounded bg-slate-50"
                                        />
                                    </span>
                                    <span className="font-bold text-emerald-700">-${discountAmount.toFixed(2)}</span>
                                </div>

                                <div className="flex justify-between text-slate-600 font-medium">
                                    <span>Flete / Logística:</span>
                                    <span className="font-bold text-slate-900">
                                        {deliveryType === 'pickup' ? '$0.00 (Pickup)' : `$${effectiveDeliveryFee.toFixed(2)}`}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center text-slate-600 font-medium">
                                    <span className="flex items-center gap-1">
                                        Sales Tax:
                                        {isTaxExempt && (
                                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.5 rounded">
                                                Exento ST-120
                                            </span>
                                        )}
                                    </span>
                                    <span className="font-bold text-slate-900">${salesTaxAmount.toFixed(2)}</span>
                                </div>

                                <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
                                    <span className="text-base font-black text-slate-900">Total Factura:</span>
                                    <span data-testid="display-grand-total" className="text-2xl font-black text-slate-900">
                                        ${grandTotal.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="space-y-3 pt-2">
                                <button
                                    type="button"
                                    data-testid="btn-confirm-and-invoice"
                                    disabled={submitting || !selectedClient || orderItems.length === 0}
                                    onClick={() => handleSubmitOrder(false)}
                                    className="w-full py-3.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-2xl font-black text-sm shadow-lg shadow-amber-600/25 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                >
                                    {submitting ? (
                                        <Loader2 className="animate-spin" size={18} />
                                    ) : (
                                        <CheckCircle2 size={18} className="stroke-[2.5]" />
                                    )}
                                    <span>Confirmar y Emitir Factura</span>
                                </button>

                                <button
                                    type="button"
                                    data-testid="btn-save-draft"
                                    disabled={submitting || !selectedClient || orderItems.length === 0}
                                    onClick={() => handleSubmitOrder(true)}
                                    className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                                >
                                    <FileText size={16} />
                                    <span>Guardar como Borrador</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
