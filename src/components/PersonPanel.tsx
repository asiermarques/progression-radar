import { initials, type Person, type Role } from "../model";

interface Props {
  person: Person;
  role?: Role;
  roles: Role[];
  onNameChange: (name: string) => void;
  onCompareToChange: (roleKey: string | undefined) => void;
}

export default function PersonPanel({ person, role, roles, onNameChange, onCompareToChange }: Props) {
  return (
    <section className="person-panel" aria-label="Person">
      <div className="person-identity">
        <span className="person-seal" aria-hidden="true">
          {initials(person.name) || "?"}
        </span>
        <div className="person-heading">
          <input
            className="person-name"
            aria-label="Name"
            placeholder="Your name"
            spellCheck={false}
            autoComplete="off"
            value={person.name}
            onChange={(event) => onNameChange(event.target.value)}
          />
          {role && <p className="person-role">{role.name}</p>}
        </div>
      </div>

      {person.tags.length > 0 && (
        <ul className="person-tags" aria-label="Tags">
          {person.tags.map((tag) => (
            <li key={tag} className="tag">
              {tag}
            </li>
          ))}
        </ul>
      )}

      {roles.length > 0 && (
        <label className="compare-to">
          <span className="compare-to-label">Compare to</span>
          <span className="compare-to-control" data-active={person.compareTo ? "" : undefined}>
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
          </span>
        </label>
      )}
    </section>
  );
}
