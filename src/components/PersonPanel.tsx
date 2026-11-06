import type { Person, Role } from "../model";

interface Props {
  person: Person;
  role?: Role;
  roles: Role[];
  onNameChange: (name: string) => void;
  onCompareToChange: (roleKey: string | undefined) => void;
}

export default function PersonPanel({ person, role, roles, onNameChange, onCompareToChange }: Props) {
  return (
    <section className="person-panel">
      <input
        className="person-name"
        aria-label="Name"
        placeholder="Your name"
        value={person.name}
        onChange={(event) => onNameChange(event.target.value)}
      />
      {role && <p className="person-role">{role.name}</p>}
      {person.tags.length > 0 && (
        <p className="person-tags">
          {person.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </p>
      )}

      {roles.length > 0 && (
        <label className="compare-to">
          Compare to
          <select
            value={person.compareTo ?? ""}
            onChange={(event) => onCompareToChange(event.target.value || undefined)}
          >
            <option value="">No role</option>
            {roles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}
