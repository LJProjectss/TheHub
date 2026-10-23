import { useState } from "react";
import { Check } from "lucide-react";
import { P } from "../theme";
import { UNCATEGORIZED, newId, toIsoDate } from "../lib/format";
import { parseInputAmount } from "../lib/csv";
import { Button, Select } from "./ui";
import { ErrorText, fieldBorder, transactionErrors } from "./TransactionRow";

export default function AddTransactionForm({ categories, onAdd, onClose }) {
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("uitgave");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState(null);

  const submit = () => {
    const value = parseInputAmount(amount);
    const found = transactionErrors({ date, description, amount: value });
    if (found) {
      setErrors(found);
      return;
    }
    onAdd({
      id: newId(),
      date,
      description: description.trim(),
      category,
      amount: type === "uitgave" ? -Math.abs(value) : Math.abs(value),
      note: note.trim(),
    });
    onClose();
  };
  // Veld wijzigen en de bijbehorende foutmarkering weghalen.
  const change = (setter, field) => (e) => {
    setter(e.target.value);
    setErrors((er) => er && { ...er, [field]: false });
  };
  const onKeyDown = (e) => {
    if (e.key === "Enter") submit();
    else if (e.key === "Escape") onClose();
  };

  const field = { borderColor: P.border };
  return (
    <div className="rounded-2xl border hb-card p-4 mb-4" style={{ borderColor: P.border, backgroundColor: P.paleBlue }}>
      <div className="grid sm:grid-cols-5 gap-3">
        <input
          type="date"
          value={date}
          onChange={change(setDate, "date")}
          onKeyDown={onKeyDown}
          className="px-3 py-2 rounded-lg border text-sm"
          style={fieldBorder(errors?.date)}
        />
        <input
          type="text"
          placeholder="Omschrijving"
          value={description}
          onChange={change(setDescription, "description")}
          onKeyDown={onKeyDown}
          autoFocus
          className="px-3 py-2 rounded-lg border text-sm sm:col-span-2"
          style={fieldBorder(errors?.description)}
        />
        <Select value={category} onChange={setCategory} options={categories} placeholder={UNCATEGORIZED} />
        <div className="flex gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-2 py-2 rounded-lg border text-sm"
            style={field}
          >
            <option value="uitgave">Uitgave</option>
            <option value="inkomst">Inkomst</option>
          </select>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={change(setAmount, "amount")}
            onKeyDown={onKeyDown}
            className="w-full px-3 py-2 rounded-lg border text-sm tabular-nums"
            style={fieldBorder(errors?.amount)}
          />
        </div>
      </div>
      <input
        type="text"
        placeholder="Notitie (optioneel)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={onKeyDown}
        className="w-full px-3 py-2 rounded-lg border text-sm mt-3"
        style={field}
      />
      <ErrorText errors={errors} className="mt-2" />
      <div className="flex justify-end gap-2 mt-3">
        <Button variant="ghost" onClick={onClose}>
          Annuleren
        </Button>
        <Button variant="primary" icon={Check} onClick={submit}>
          Toevoegen
        </Button>
      </div>
    </div>
  );
}
