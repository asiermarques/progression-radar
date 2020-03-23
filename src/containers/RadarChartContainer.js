import { connect } from 'react-redux';
import RadarChart from '../components/RadarChart';

const mapStateToProps = state => {
  return {
    categories: state.personLevels.map(categoryWithLevel => categoryWithLevel.category.name),
    targetSerie: {
      name: state.name,
      data: state.personLevels.map(categoryWithLevel => categoryWithLevel.percentage)
    },
    compareSerie: state.compareTo?{
      name: state.compareTo.getName(),
      data: state.compareToLevels.map(categoryWithLevel => categoryWithLevel.percentage)
    }:null
  }
}

export default connect(
    mapStateToProps,
    null
)(RadarChart);