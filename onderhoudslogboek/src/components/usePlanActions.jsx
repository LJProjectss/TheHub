import { useState } from 'react';
import { useStore } from '../store.jsx';
import LogForm from './LogForm.jsx';
import PlanForm from './PlanForm.jsx';

/** Gedeelde acties voor gepland onderhoud: afvinken, bewerken, verwijderen */
export default function usePlanActions() {
  const { t, dispatch } = useStore();
  const [modal, setModal] = useState(null);
  const close = () => setModal(null);

  const onDone = (entry) =>
    setModal(<LogForm item={entry.item} completing={entry.plan} onClose={close} />);
  const onEdit = (entry) => setModal(<PlanForm plan={entry.plan} onClose={close} />);
  const onDelete = (entry) => {
    if (window.confirm(t('confirmDeletePlan'))) dispatch({ type: 'DELETE_PLAN', id: entry.plan.id });
  };
  const onAdd = (itemId) => setModal(<PlanForm itemId={itemId} onClose={close} />);

  return { modal, onDone, onEdit, onDelete, onAdd };
}
