'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface CategoryFiltersProps {
    categories: string[];
    activeCategory: string;
    onCategoryChange: (category: string) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
}

export const CategoryFilters = ({ categories, activeCategory, onCategoryChange, searchQuery, onSearchChange }: CategoryFiltersProps) => {
    const { t } = useLanguage();
    return (
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-white/70 backdrop-blur-md p-3 rounded-[2rem] border border-border/60 shadow-xs">
            {/* Category pills rail */}
            <div className="flex items-center gap-2 overflow-x-auto scroll-smooth py-1 px-1 no-scrollbar flex-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => onCategoryChange(cat)}
                        className={`shrink-0 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${activeCategory === cat ? 'bg-primary text-white shadow-xs' : 'bg-white border border-border/60 text-foreground/75 hover:bg-primary/5 hover:text-primary'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Search box */}
            <div className="relative shrink-0 w-full md:w-64 border-t md:border-t-0 md:border-l border-border/40 pt-2 md:pt-0 md:pl-3">
                <Search className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={15} />
                <input
                    type="text"
                    placeholder={t.catalog.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 rounded-full bg-white border border-border/60 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-all shadow-xs placeholder:text-muted-foreground/50"
                />
            </div>
        </div>
    );
};
