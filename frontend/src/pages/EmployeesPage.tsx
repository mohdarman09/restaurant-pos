import { useEffect, useState } from 'react';
import { LogIn, LogOut, IndianRupee } from 'lucide-react';
import {
  fetchEmployees, checkInSelf, checkOutSelf, fetchAttendance, Employee,
  fetchCurrentSalaries, setEmployeeSalary, fetchSalaryPayments, recordSalaryPayment, CurrentSalary, SalaryPayment,
} from '../api/misc';

interface AttendanceRow { id: string; full_name: string; check_in: string; check_out: string | null; work_date: string }

const CURRENT_MONTH = new Date().toISOString().slice(0, 7); // YYYY-MM

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [salaries, setSalaries] = useState<CurrentSalary[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [busy, setBusy] = useState(false);
  const [editingSalaryFor, setEditingSalaryFor] = useState<string | null>(null);
  const [salaryInput, setSalaryInput] = useState('');

  function load() {
    fetchEmployees().then(setEmployees);
    fetchAttendance().then(setAttendance);
    fetchCurrentSalaries().then(setSalaries);
    fetchSalaryPayments().then(setPayments);
  }

  useEffect(load, []);

  async function handleCheckIn() {
    setBusy(true);
    try { await checkInSelf(); load(); } finally { setBusy(false); }
  }
  async function handleCheckOut() {
    setBusy(true);
    try { await checkOutSelf(); load(); } finally { setBusy(false); }
  }

  async function saveSalary(userId: string) {
    if (!salaryInput) return;
    await setEmployeeSalary(userId, Number(salaryInput), new Date().toISOString().slice(0, 10));
    setEditingSalaryFor(null);
    setSalaryInput('');
    load();
  }

  async function payThisMonth(userId: string, amount: number) {
    await recordSalaryPayment(userId, `${CURRENT_MONTH}-01`, amount);
    load();
  }

  const alreadyPaidThisMonth = new Set(
    payments.filter((p) => p.period_month.startsWith(CURRENT_MONTH)).map((p) => p.full_name)
  );

  return (
    <div className="space-y-6">
      <div className="ticket p-5 flex items-center justify-between">
        <div>
          <p className="font-display uppercase tracking-wide text-sm text-ink-muted">My Attendance Today</p>
          <p className="text-xs text-ink-faint mt-1">Check in when your shift starts, check out when it ends.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCheckIn}
            disabled={busy}
            className="flex items-center gap-1.5 bg-sage-500 text-white font-semibold text-sm px-4 py-2 rounded-lg disabled:opacity-50"
          >
            <LogIn size={15} /> Check In
          </button>
          <button
            onClick={handleCheckOut}
            disabled={busy}
            className="flex items-center gap-1.5 bg-brick-500 text-white font-semibold text-sm px-4 py-2 rounded-lg disabled:opacity-50"
          >
            <LogOut size={15} /> Check Out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="ticket overflow-hidden">
          <p className="font-display uppercase tracking-wide text-sm text-ink-muted px-4 pt-4 pb-2">Staff Directory</p>
          <table className="w-full text-sm">
            <thead className="bg-paper text-ink-faint text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Role</th>
                <th className="text-center px-4 py-2 font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-t border-ink/5">
                  <td className="px-4 py-2.5">{e.full_name}</td>
                  <td className="px-4 py-2.5 capitalize text-ink-faint">{e.role.replace('_', ' ')}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${e.is_active ? 'bg-sage-500' : 'bg-ink-faint/40'}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ticket overflow-hidden">
          <p className="font-display uppercase tracking-wide text-sm text-ink-muted px-4 pt-4 pb-2">Recent Attendance</p>
          <table className="w-full text-sm">
            <thead className="bg-paper text-ink-faint text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Date</th>
                <th className="text-right px-4 py-2 font-medium">In</th>
                <th className="text-right px-4 py-2 font-medium">Out</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((a) => (
                <tr key={a.id} className="border-t border-ink/5">
                  <td className="px-4 py-2.5">{a.full_name}</td>
                  <td className="px-4 py-2.5 text-ink-faint text-xs">{new Date(a.work_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  <td className="px-4 py-2.5 text-right text-xs">{new Date(a.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-4 py-2.5 text-right text-xs">{a.check_out ? new Date(a.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                </tr>
              ))}
              {attendance.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-faint">No attendance records yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ticket overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <IndianRupee size={15} className="text-ink-muted" />
          <p className="font-display uppercase tracking-wide text-sm text-ink-muted">Payroll — {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-paper text-ink-faint text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-right px-4 py-2 font-medium">Base Salary</th>
              <th className="text-center px-4 py-2 font-medium">This Month</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {salaries.map((s) => {
              const paid = alreadyPaidThisMonth.has(s.full_name);
              return (
                <tr key={s.user_id} className="border-t border-ink/5">
                  <td className="px-4 py-2.5">{s.full_name}</td>
                  <td className="px-4 py-2.5 text-right">
                    {editingSalaryFor === s.user_id ? (
                      <input
                        autoFocus
                        type="number"
                        value={salaryInput}
                        onChange={(e) => setSalaryInput(e.target.value)}
                        onBlur={() => saveSalary(s.user_id)}
                        onKeyDown={(e) => e.key === 'Enter' && saveSalary(s.user_id)}
                        className="w-28 text-right rounded border border-ink/15 px-2 py-1"
                      />
                    ) : (
                      <button
                        onClick={() => { setEditingSalaryFor(s.user_id); setSalaryInput(s.base_salary ?? ''); }}
                        className="hover:underline"
                      >
                        {s.base_salary ? `₹${Number(s.base_salary).toFixed(0)}` : 'Set salary'}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${paid ? 'bg-sage-400/15 text-sage-500' : 'bg-amber-400/15 text-amber-600'}`}>
                      {paid ? 'Paid' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {!paid && s.base_salary && (
                      <button
                        onClick={() => payThisMonth(s.user_id, Number(s.base_salary))}
                        className="text-xs font-medium px-3 py-1.5 rounded-md bg-brand-500 text-white"
                      >
                        Pay Now
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {salaries.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-faint">No staff to run payroll for yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
