import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import {
    FileEdit, CheckCircle, XCircle
} from 'lucide-react';
import { Card, Button } from '../ui/Elements';

export default function AdminDataRequests({ showToast }) {
    const [requests, setRequests] = useState([]);

    const fetchRequests = async () => {
        const { data } = await supabase.from('edit_requests').select('*').eq('status', 'pending');
        if (data) setRequests(data);
    };

    useEffect(() => {
        fetchRequests();
        const channel = supabase.channel('admin_data_requests')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'edit_requests' }, fetchRequests)
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleAction = async (req, action) => {
        try {
            // Update request status
            const { error: err1 } = await supabase.from('edit_requests').update({ status: action }).eq('id', req.id);
            if (err1) throw err1;

            // Update student edit_request status (assuming edit_request is a JSONB column)
            // We fetch the current value first to preserve other fields in the JSONB object
            const { data: student, error: fetchError } = await supabase.from('students').select('edit_request').eq('id', req.student_id).single();

            if (student) {
                const currentRequest = student.edit_request || {};
                const updatedRequest = { ...currentRequest, status: action };

                const { error: err2 } = await supabase.from('students').update({ edit_request: updatedRequest }).eq('id', req.student_id);
                if (err2) throw err2;
            } else if (fetchError) {
                console.warn("Could not fetch student to update edit_request:", fetchError);
            }

            showToast(`Permintaan ${action === 'approved' ? 'disetujui' : 'ditolak'}`);
            fetchRequests();
        } catch (e) { showToast(e.message, 'error'); }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><FileEdit className="text-emerald-600" /> Permintaan Perubahan Data</h2>
            <div className="space-y-4">
                {requests.length === 0 ? <div className="text-center p-10 text-slate-400 border border-dashed rounded-xl">Tidak ada permintaan edit data baru.</div> : (
                    requests.map(req => (
                        <Card key={req.id} className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="font-bold text-slate-800">{req.student_name}</h4>
                                    <p className="text-xs text-slate-500">Wali: {req.parent_name}</p>
                                </div>
                                <div className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">{new Date(req.requested_at).toLocaleDateString()}</div>
                            </div>
                            <div className="bg-amber-50 p-3 rounded text-sm text-amber-900 border border-amber-100 mb-4">
                                <strong>Alasan:</strong> {req.reason}
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button variant="danger" onClick={() => handleAction(req, 'rejected')} className="px-3 text-xs"><XCircle className="mr-1" size={14} /> Tolak</Button>
                                <Button onClick={() => handleAction(req, 'approved')} className="px-3 text-xs"><CheckCircle className="mr-1" size={14} /> Izinkan Edit</Button>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
