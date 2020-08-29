import { connect } from "react-redux";
import PersonPanel from "../components/PersonPanel";
import { updateName } from "../actions/all";

const mapStateToProps = state => {
  return {
    name: state.name
  };
};

const mapDispatchToProps = dispatch => ({
  updateName: name => dispatch(updateName(name))
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PersonPanel);
