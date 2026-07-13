import { CheckboxToggle } from "../shared/CheckboxToggle.jsx";

/** Small labeled checkbox that toggles company rows into the vehicles views. */
export function IncludeCompaniesToggle({ checked, onChange, tc }) {
  return <CheckboxToggle checked={checked} onChange={onChange} label="Incloure companies" tc={tc} />;
}
