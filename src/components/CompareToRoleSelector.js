import React from "react";
import PropTypes from "prop-types";

class CompareToRoleSelector extends React.Component {
  constructor(props) {
    super(props);
    this.roles = props.roles;
    this.compareTo = props.compareTo;
    this.dispatchSelectComparationRole = props.selectComparationRole;
  }

  selectComparationRole = e =>
    this.dispatchSelectComparationRole(e.target.value);

  render = () => (
    <label id="role-selector">
      Compare to{" "}
      <select
        className="form-control roles"
        onChange={this.selectComparationRole.bind(this)}
        defaultValue={this.compareTo?.key}
      >
        <option>Select a role</option>
        {this.roles.map(role => (
          <option key={role.key} value={role.key}>
            {role.name}
          </option>
        ))}
      </select>
    </label>
  );
}

CompareToRoleSelector.propTypes = {
  compareTo: PropTypes.object,
  roles: PropTypes.arrayOf(Object).isRequired,
  selectComparationRole: PropTypes.func.isRequired
};

export default CompareToRoleSelector;
