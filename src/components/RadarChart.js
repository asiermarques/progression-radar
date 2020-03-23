import React from 'react';
import PropTypes from 'prop-types';
import Chart from 'react-apexcharts';

const RadarChart = (props) => {

  const series = [props.targetSerie];
  if(props.compareSerie)
    series.push(props.compareSerie);
    
  const state = {
      options: {
        chart: {
          id: 'radar',
          toolbar: {
            show: false
          }
        },
        plotOptions: {
          radar: {
            polygons: {
              strokeColor: '#e8e8e8',
              fill: {
                  colors: ['#f8f8f8', '#fff']
              }
            }
          }
        },
        xaxis: {
          categories: props.categories
        },
        yaxis: {max: 100, show: false, tickAmount: 5, labels: {formatter: (number) => number + "%"}}
      },
      series: series
  };

    return (<Chart id="radar-chart"
        options={state.options} 
        series={state.series} 
        type="radar" 
        width={"100%"} 
        height={600} />)
}


RadarChart.propTypes = {
  targetSerie: PropTypes.object.isRequired,
  compareSerie: PropTypes.object,
  categories: PropTypes.arrayOf(String)
};

export default RadarChart;