import { connect } from "react-redux";
import CompareToRoleSelector from "../components/CompareToRoleSelector";
import { selectComparationRole } from "../actions/all";

const mapStateToProps = state => {
  return {
    compareTo: state.compareTo
  };
};

const mapDispatchToProps = dispatch => ({
  selectComparationRole: roleKey => dispatch(selectComparationRole(roleKey))
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(CompareToRoleSelector);
