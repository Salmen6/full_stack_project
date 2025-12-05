// src/pages/AdminDashboard.jsx
import React, { useEffect, useState } from 'react';
import ExamService from '../services/ExamService';

// --- Original Helper Functions (Unchanged Logic) ---
const fmtDate = (s) => s?.date_seance || s?.date || s?.dateSeance || '—';
const fmtStart = (s) => s?.heure_debut || s?.heureDebut || s?.start || '—';
const fmtEnd = (s) => s?.heure_fin || s?.heureFin || s?.end || '—';

// --- Reusable UI Component: Alert (Matched from TeacherDashboard) ---
const Alert = ({ type, text }) => {
    let baseClasses = "p-3 rounded-xl flex items-center shadow-md mb-6";
    let icon = "💡"; // Default icon
    let colorClasses = "";

    switch (type) {
        case 'success':
            colorClasses = "bg-green-100 border border-green-400 text-green-700";
            icon = "✅"; // CheckCircleIcon
            break;
        case 'danger':
            colorClasses = "bg-red-100 border border-red-400 text-red-700";
            icon = "🚨"; // ExclamationCircleIcon
            break;
        default:
            colorClasses = "bg-blue-100 border border-blue-400 text-blue-700";
            icon = "💡";
    }

    return (
        <div className={`${baseClasses} ${colorClasses}`} role="alert">
            <span className="mr-3 text-lg">{icon}</span>
            <p className="text-sm font-medium">{text}</p>
        </div>
    );
};

const AdminDashboard = () => {
    const [seances, setSeances] = useState([]);
    const [enseignants, setEnseignants] = useState([]);
    const [voeux, setVoeux] = useState([]);
    const [selectedSeanceId, setSelectedSeanceId] = useState('');
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [message, setMessage] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // --- Original Logic: Data Loading (Unchanged) ---
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const s = await ExamService.getAllSeances();
            const t = await ExamService.getAllEnseignants();
            const v = await ExamService.getAllVoeux();

            setSeances(Array.isArray(s.data) ? s.data : []);
            setEnseignants(Array.isArray(t.data) ? t.data : []);
            setVoeux(Array.isArray(v.data) ? v.data : []);
            setMessage(null);
        } catch (err) {
            console.error('Error loading admin data', err);
            setMessage({ type: 'danger', text: 'Failed to load data from backend.' });
        } finally {
            setIsLoading(false);
        }
    };

    // --- Original Logic: Assignment Mapping (Unchanged) ---
    // Build mapping: seanceId -> array of teachers assigned
    const assignmentsBySeance = () => {
        const map = {};
        (Array.isArray(enseignants) ? enseignants : []).forEach(ens => {
            (Array.isArray(ens.affectations) ? ens.affectations : []).forEach(aff => {
                // Handle different possible key names for seance ID
                const sid = aff?.seance?.id ?? aff?.id_seance ?? aff?.idSeance ?? aff?.seance;
                if (!map[sid]) map[sid] = [];
                map[sid].push(ens);
            });
        });
        return map;
    };

    const assignedMap = assignmentsBySeance();
    const selectedSeance = (Array.isArray(seances) ? seances : []).find(s => s.id === parseInt(selectedSeanceId));

    // --- Original Logic: Eligibility Check (Unchanged) ---
    const isEligible = (teacher, seance) => {
        if (!teacher || !seance) return false;
        // Use frontend helpers, server will enforce too
        if (ExamService.subjectConflict(teacher, seance)) return false;
        if (ExamService.timeOverlap(teacher, seance)) return false;
        return true;
    };

    // --- Original Logic: Get Eligible Teachers (Unchanged) ---
    const getEligibleTeachers = () => {
        if (!selectedSeance) return [];
        return (Array.isArray(enseignants) ? enseignants : []).filter(t => isEligible(t, selectedSeance));
    };

    // --- Original Logic: Filter Wishes (Unchanged) ---
    const wishesForSelectedSession = selectedSeance
        ? (Array.isArray(voeux) ? voeux : []).filter(v => (v.seance?.id ?? v.seance) === selectedSeance.id)
        : [];

    // --- Original Logic: Handle Assign (Unchanged) ---
    const handleAssign = async () => {
        if (!selectedSeanceId || !selectedTeacherId) return;
        try {
            // Convert IDs to strings if the service expects them as such, or keep them as is if the service handles the type.
            // Keeping them as strings for consistency with select values.
            const res = await ExamService.assignSurveillant(selectedTeacherId, selectedSeanceId); 
            setMessage({ type: 'success', text: res.data || 'Assigned successfully.' });
            setSelectedTeacherId('');
            setSelectedSeanceId('');
            await loadData();
        } catch (err) {
            console.error(err);
            setMessage({ type: 'danger', text: err.response?.data || 'Assignment failed. Check for conflicts or server issues.' });
        }
    };

    // --- Original Logic: Handle Recalculate (Unchanged) ---
    const handleRecalculate = async (id) => {
        try {
            await ExamService.calculateSeanceNeeds(id);
            setMessage({ type: 'success', text: `Recalculation initiated for session ID ${id}.` });
            await loadData();
        } catch (err) {
            setMessage({ type: 'danger', text: 'Failed to recalculate session needs.' });
        }
    };

    // --- Original Logic: Grouped Wishes (Unchanged) ---
    const wishesGrouped = (Array.isArray(seances) ? seances : []).map(s => ({
        seance: s,
        wishes: (Array.isArray(voeux) ? voeux : []).filter(v => (v.seance?.id ?? v.seance) === s.id)
    }));
    
    // UI Helpers

    const TeacherOption = ({ teacher }) => (
        <option key={teacher.id} value={teacher.id}>
            {teacher.nomComplet} (Quota: {teacher.chargeSurveillance ?? '—'})
        </option>
    );

    const SessionOption = ({ session }) => {
        const ins = session.nbSurveillantsInscrits ?? session.nb_surveillants_inscrits ?? 0;
        const need = session.nbSurveillantsNecessaires ?? session.nb_surveillants_necessaires ?? 0;
        const needed = Math.max(0, need - ins);

        return (
            <option key={session.id} value={session.id}>
                {fmtDate(session)} ({fmtStart(session)}) - Needed: {needed} ({ins}/{need})
            </option>
        );
    };


    // --- UI Structure with Tailwind CSS Classes ---
    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8 lg:p-10">
            <header className="mb-8">
                <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
                     Admin Dashboard - Surveillance
                </h1>
                <p className="text-gray-500 mt-1">Manage assignments and monitor session statuses.</p>
            </header>

            {/* Global Message Alert */}
            {message && <Alert type={message.type} text={message.text} />}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left Column: Manual Assignment (Smaller Column) */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-indigo-200">
                        <div className="mb-4 text-lg font-semibold text-white bg-indigo-600 rounded-lg p-3 -mt-2 -mx-2 shadow-md">
                            Quick Assignment Tool
                        </div>

                        {/* 1. Select Session */}
                        <div className="mb-5">
                            <label className="block text-sm font-bold text-gray-700 mb-2">1. Select Session</label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 text-sm"
                                value={selectedSeanceId}
                                onChange={(e) => setSelectedSeanceId(e.target.value)}
                                disabled={isLoading}
                            >
                                <option value="">-- Choose Session --</option>
                                {(Array.isArray(seances) ? seances : []).map(s => <SessionOption key={s.id} session={s} />)}
                            </select>
                            {(Array.isArray(seances) && seances.length === 0 && !isLoading) && <p className="text-xs text-red-500 mt-1">No sessions available.</p>}
                        </div>

                        {/* Session Wishes Preview */}
                        {selectedSeance && (
                            <div className="mb-5 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                                <label className="block text-xs font-semibold text-indigo-700 uppercase mb-2">Wishes ({wishesForSelectedSession.length})</label>
                                {wishesForSelectedSession.length > 0 ? (
                                    <ul className="divide-y divide-indigo-100 max-h-48 overflow-y-auto">
                                        {wishesForSelectedSession.map(v => (
                                            <li key={v.id} className="flex justify-between items-center py-1.5 text-sm">
                                                <span className="text-gray-800 font-medium">{v.enseignant?.nomComplet || v.enseignant}</span>
                                                <button
                                                    className="px-2 py-0.5 text-xs rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition"
                                                    onClick={() => setSelectedTeacherId(v.enseignant?.id || v.enseignant)}
                                                >
                                                    Select
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="text-gray-500 text-sm italic">No wishes submitted for this session.</div>
                                )}
                            </div>
                        )}

                        {/* 2. Select Teacher */}
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 mb-2">2. Select Teacher (Eligible)</label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 text-sm"
                                value={selectedTeacherId}
                                onChange={(e) => setSelectedTeacherId(e.target.value)}
                                disabled={!selectedSeanceId || isLoading}
                            >
                                <option value="">-- Choose Teacher --</option>
                                {getEligibleTeachers().map(t => <TeacherOption key={t.id} teacher={t} />)}
                            </select>
                            {selectedSeanceId && getEligibleTeachers().length === 0 && (
                                <p className="text-xs text-red-500 mt-1">No eligible teachers found for this session.</p>
                            )}
                        </div>

                        {/* Assign Button */}
                        <button
                            onClick={handleAssign}
                            className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white transition duration-150 ease-in-out ${selectedTeacherId ? 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500' : 'bg-gray-400 cursor-not-allowed'}`}
                            disabled={!selectedTeacherId || isLoading}
                        >
                            Assign Teacher
                        </button>
                    </div>
                </div>

                {/* Right Column: Overview & Wishes (Larger Column) */}
                <div className="lg:col-span-7 space-y-6">
                    {/* All Sessions Overview Table */}
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
                        <div className="p-4 bg-gray-800 text-white font-semibold">
                            All Sessions Overview
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subjects</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Supervisors (Reg/Req)</th>
                                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Wishes</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Teachers</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan="6" className="text-center py-8 text-gray-500">Loading sessions...</td>
                                        </tr>
                                    ) : (Array.isArray(seances) ? seances : []).map(s => {
                                        const wishCount = (Array.isArray(voeux) ? voeux : []).filter(v => (v.seance?.id ?? v.seance) === s.id).length;
                                        const ins = s.nbSurveillantsInscrits ?? s.nb_surveillants_inscrits ?? 0;
                                        const need = s.nbSurveillantsNecessaires ?? s.nb_surveillants_necessaires ?? 0;
                                        const isCritical = ins < need;
                                        const assigned = assignedMap[s.id] || [];

                                        const statusColor = s.saturee ? 'bg-green-100 text-green-800' : (isCritical ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800');

                                        return (
                                            <tr key={s.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-3 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">{fmtDate(s)}</div>
                                                    <div className="text-xs text-gray-500">{fmtStart(s)} - {fmtEnd(s)}</div>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <ul className="list-disc list-inside space-y-0.5 text-xs text-gray-700">
                                                        {(Array.isArray(s.epreuves) ? s.epreuves : []).slice(0, 2).map((e, index) => (
                                                            <li key={index} className="truncate">• {e.matiere?.nom || e.matiere_nom}</li>
                                                        ))}
                                                        {(Array.isArray(s.epreuves) ? s.epreuves : []).length > 2 && <li className="text-gray-500 italic text-xs">+{(Array.isArray(s.epreuves) ? s.epreuves : []).length - 2} more...</li>}
                                                    </ul>
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap text-center">
                                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${statusColor}`}>
                                                        {ins} / {need}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-center whitespace-nowrap text-sm text-indigo-600 font-semibold">{wishCount}</td>
                                                <td className="px-6 py-3">
                                                    {assigned.length > 0 ? (
                                                        <ul className="list-disc list-inside space-y-0.5 text-xs text-gray-700 max-w-[150px]">
                                                            {assigned.slice(0, 3).map(a => <li key={a.id} className="truncate">{a.nomComplet}</li>)}
                                                            {assigned.length > 3 && <li className="text-gray-500 italic">+{(assigned.length) - 3} more...</li>}
                                                        </ul>
                                                    ) : <span className="text-gray-500 text-xs italic">None</span>}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                                    <button 
                                                        className="px-3 py-1 text-xs font-medium rounded-md text-white bg-yellow-500 hover:bg-yellow-600 transition" 
                                                        onClick={() => handleRecalculate(s.id)}
                                                        disabled={isLoading}
                                                    >
                                                        Recalc Needs
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {(Array.isArray(seances) && seances.length === 0 && !isLoading) && (
                                        <tr>
                                            <td colSpan="6" className="text-center py-8 text-gray-500">No sessions available.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* All Wishes Grouped Card */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100">
                        <div className="p-4 bg-gray-100 font-semibold text-gray-700">
                            All Wishes (Grouped by Session)
                        </div>
                        <div className="p-4 divide-y divide-gray-200 max-h-96 overflow-y-auto">
                            {(Array.isArray(seances) ? wishesGrouped : []).map(g => (
                                <div key={g.seance.id} className="py-3">
                                    <h4 className="font-bold text-gray-900 text-sm">
                                        {fmtDate(g.seance)} {fmtStart(g.seance)}-{fmtEnd(g.seance)}
                                    </h4>
                                    <div className="pl-4 text-xs text-gray-600 mt-1">
                                        {Array.isArray(g.wishes) && g.wishes.length ? (
                                            <ul className="list-disc space-y-0.5">
                                                {g.wishes.map(w => (
                                                    <li key={w.id}>
                                                        {w.enseignant?.nomComplet || w.enseignant} — <span className="text-gray-400">{w.date_soumission || w.date || 'N/A'}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <div className="text-gray-500 italic">No wishes submitted.</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;