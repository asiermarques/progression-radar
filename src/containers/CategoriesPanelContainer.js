import { connect } from 'react-redux'
import CategoriesPanel from '../components/CategoriesPanel'
import { selectCategoryLevel} from '../actions/all'

const mapStateToProps = state => {
    return {
        selectedLevels: state.levels
    }
}

const mapDispatchToProps = dispatch => ({
    selectCategoryLevel: (category, level) => dispatch(selectCategoryLevel(category, level))
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(CategoriesPanel);