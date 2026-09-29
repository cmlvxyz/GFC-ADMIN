import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Plus, Download, Trash2, Calendar, Search, 
  RotateCcw, DollarSign, TrendingUp, TrendingDown, Wallet, CheckCircle, Tag
} from 'lucide-react';
import { LedgerTransaction, LedgerTotals, LedgerFilter } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useToast } from '../common/Toast.tsx';

export const TithesLedgerView: React.FC = () => {
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [totals, setTotals] = useState<LedgerTotals>({
    totalIn: 0,
    totalOut: 0,
    balance: 0,
    endingBalance: 0,
    count: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form State
  const todayStr = new Date().toISOString().slice(0, 10);
  const [formDate, setFormDate] = useState<string>(todayStr);
  const [formIn, setFormIn] = useState<string>('');
  const [formOut, setFormOut] = useState<string>('');
  const [formPurpose, setFormPurpose] = useState<string>('');
  const [formForPastor, setFormForPastor] = useState<boolean>(false);

  // Filter State
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'year' | 'month' | 'date' | 'range'>('all');
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [filterDate, setFilterDate] = useState<string>(todayStr);
  const [filterFrom, setFilterFrom] = useState<string>('');
  const [filterTo, setFilterTo] = useState<string>('');
  const [appliedFilter, setAppliedFilter] = useState<LedgerFilter | null>(null);

  const formatPHP = (val: number) => {
    return '₱' + Number(val || 0).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const loadData = async (filter?: LedgerFilter) => {
    setLoading(true);
    try {
      const res = await api.getTransactions(filter);
      setTransactions(res.transactions);
      setTotals(res.totals);
    } catch (err: any) {
      showToast('error', 'Failed to load ledger', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApplyFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    let f: LedgerFilter | null = null;
    if (activeFilterTab === 'year') {
      f = { type: 'year', year: filterYear, label: `Year ${filterYear}` };
    } else if (activeFilterTab === 'month') {
      f = { type: 'month', month: filterMonth, label: `Month ${filterMonth}` };
    } else if (activeFilterTab === 'date') {
      f = { type: 'date', date: filterDate, label: `Date ${filterDate}` };
    } else if (activeFilterTab === 'range') {
      f = { type: 'range', from: filterFrom, to: filterTo, label: `${filterFrom || 'Start'} to ${filterTo || 'End'}` };
    }

    setAppliedFilter(f);
    loadData(f || undefined);
    if (f) {
      showToast('info', 'Filter Applied', `Viewing records for ${f.label}`);
    }
  };

  const handleClearFilter = () => {
    setActiveFilterTab('all');
    setAppliedFilter(null);
    loadData();
    showToast('info', 'Filter Reset', 'Showing all chronological transactions');
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const pasokNum = parseFloat(formIn) || 0;
    const labasNum = parseFloat(formOut) || 0;

    if (!formDate) {
      showToast('error', 'Missing Date', 'Please select a transaction date.');
      return;
    }

    if (pasokNum === 0 && labasNum === 0) {
      showToast('error', 'Invalid Amount', 'Please enter either an Amount In (pasok) or Amount Out (labas).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.addTransaction({
        date: formDate,
        pasok: pasokNum,
        labas: labasNum,
        purpose: formPurpose.trim(),
        forPastor: formForPastor,
      });

      showToast('success', 'Entry Saved', `Recorded: +₱${pasokNum.toFixed(2)} / -₱${labasNum.toFixed(2)}`);
      setFormIn('');
      setFormOut('');
      setFormPurpose('');
      setFormForPastor(false);
      loadData(appliedFilter || undefined);
    } catch (err: any) {
      showToast('error', 'Error adding transaction', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, date: string, purpose: string) => {
    if (!window.confirm(`Are you sure you want to delete this ledger transaction (${date} - ${purpose || 'Entry'})?`)) {
      return;
    }

    try {
      await api.deleteTransaction(id);
      showToast('success', 'Transaction Deleted', `Entry #${id} removed.`);
      loadData(appliedFilter || undefined);
    } catch (err: any) {
      showToast('error', 'Failed to delete', err.message);
    }
  };

  const handleReloadSample = async () => {
    if (!window.confirm('Reload standard GFC sample tithes and offerings? This will restore initial ledger transactions.')) {
      return;
    }
    try {
      await api.seedSampleTransactions();
      showToast('success', 'Sample Data Restored', 'GFC ledger sample records reloaded.');
      setActiveFilterTab('all');
      setAppliedFilter(null);
      loadData();
    } catch (err: any) {
      showToast('error', 'Failed to load sample data', err.message);
    }
  };

  const exportUrl = api.getExportCsvUrl(appliedFilter || undefined);

  return (
    <div className="space-y-6">
      {/* Top Banner & Scripture */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                GFC Tithes &amp; Offering Ledger
              </h1>
              <p className="text-xs text-slate-500">
                Gospel Fellowship Church • Transparent Financial Stewardship
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={exportUrl}
              download="GFC_Tithes_Offering_Ledger.csv"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Export CSV</span>
            </a>

            <button
              onClick={handleReloadSample}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              title="Reload default sample ledger"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span>Sample Data</span>
            </button>
          </div>
        </div>

        {/* Scripture Verse */}
        <div className="mt-4 p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-relaxed text-center sm:text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="italic">“Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver.”</span>
          </div>
          <span className="font-bold text-indigo-700 shrink-0">2 Corinthians 9:7 (NIV)</span>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total In */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total In (Pasok)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {formatPHP(totals.totalIn)}
          </p>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">
            Tithes, offerings &amp; donations
          </p>
        </div>

        {/* Total Out */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Out (Labas)
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-600 mt-2">
            {formatPHP(totals.totalOut)}
          </p>
          <p className="text-[11px] text-rose-500 font-medium mt-1">
            Utilities, ministries &amp; outreach
          </p>
        </div>

        {/* Current Balance */}
        <div className="bg-white rounded-2xl border-2 border-indigo-500 p-5 shadow-xs bg-indigo-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
              Current Balance
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-indigo-950 mt-2">
            {formatPHP(totals.balance)}
          </p>
          <p className="text-[11px] text-indigo-700 font-medium mt-1">
            Active church ministry funds
          </p>
        </div>

        {/* Records Count */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Records Count
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {totals.count}
          </p>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            {appliedFilter ? `Filtered: ${appliedFilter.label}` : 'All ledger transactions'}
          </p>
        </div>
      </div>

      {/* Add Transaction Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-indigo-600" />
          <span>Add New Ledger Transaction</span>
        </h3>

        <form onSubmit={handleAddTransaction} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          {/* Date */}
          <div className="lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-medium focus:outline-indigo-500"
              required
            />
          </div>

          {/* Amount In */}
          <div className="lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Amount In (₱ Pasok)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formIn}
              onChange={(e) => setFormIn(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-medium focus:outline-indigo-500"
            />
          </div>

          {/* Amount Out */}
          <div className="lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Amount Out (₱ Labas)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formOut}
              onChange={(e) => setFormOut(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-medium focus:outline-indigo-500"
            />
          </div>

          {/* Purpose / Remarks */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Purpose / Description
            </label>
            <input
              type="text"
              placeholder="e.g. Sunday Tithes, Electricity, Outreach"
              value={formPurpose}
              onChange={(e) => setFormPurpose(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-medium focus:outline-indigo-500"
            />
          </div>

          {/* Submit Button */}
          <div className="lg:col-span-1 flex flex-col gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={formForPastor}
                onChange={(e) => setFormForPastor(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-0"
              />
              <span>For Pastor</span>
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{submitting ? 'Saving...' : '+ Add Entry'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-800">
              Filter Ledger By:
            </span>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => { setActiveFilterTab('all'); handleClearFilter(); }}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                activeFilterTab === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveFilterTab('year')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                activeFilterTab === 'year'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Year
            </button>
            <button
              onClick={() => setActiveFilterTab('month')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                activeFilterTab === 'month'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setActiveFilterTab('date')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                activeFilterTab === 'date'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Exact Date
            </button>
            <button
              onClick={() => setActiveFilterTab('range')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                activeFilterTab === 'range'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Date Range
            </button>
          </div>
        </div>

        {/* Dynamic Filter Controls */}
        {activeFilterTab !== 'all' && (
          <form onSubmit={handleApplyFilter} className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            {activeFilterTab === 'year' && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600 font-semibold">Select Year:</label>
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs w-28"
                  required
                />
              </div>
            )}

            {activeFilterTab === 'month' && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600 font-semibold">Select Month:</label>
                <input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                  required
                />
              </div>
            )}

            {activeFilterTab === 'date' && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600 font-semibold">Select Date:</label>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                  required
                />
              </div>
            )}

            {activeFilterTab === 'range' && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-slate-600 font-semibold">From:</label>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                  required
                />
                <label className="text-xs text-slate-600 font-semibold">To:</label>
                <input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Search
            </button>

            {appliedFilter && (
              <button
                type="button"
                onClick={handleClearFilter}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Clear Filter
              </button>
            )}
          </form>
        )}
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Chronological Ledger Records
            </h3>
            <p className="text-xs text-slate-500">
              {appliedFilter ? `Filtered: ${appliedFilter.label}` : 'All church financial transactions'}
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500">
            {transactions.length} record{transactions.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">Loading ledger records...</div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No transactions found. Use the form above to add a new record.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Amount In (₱)</th>
                  <th className="py-3 px-4">Amount Out (₱)</th>
                  <th className="py-3 px-4">Purpose / Remarks</th>
                  <th className="py-3 px-4">Pastor Share</th>
                  <th className="py-3 px-4 font-extrabold text-slate-900">Running Balance (₱)</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-3 px-4 text-emerald-700 font-bold whitespace-nowrap">
                      {tx.pasok > 0 ? formatPHP(tx.pasok) : '—'}
                    </td>
                    <td className="py-3 px-4 text-rose-600 font-bold whitespace-nowrap">
                      {tx.labas > 0 ? formatPHP(tx.labas) : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-800">
                      {tx.purpose || <span className="text-slate-400 italic">General</span>}
                    </td>
                    <td className="py-3 px-4">
                      {tx.forPastor ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Yes
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-black text-indigo-900 whitespace-nowrap">
                      {formatPHP(tx.balance)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDelete(tx.id, tx.date, tx.purpose)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
