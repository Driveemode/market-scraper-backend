import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import axios from 'axios';

const VisualizationComponent = () => {
  const [vendorChartData, setVendorChartData] = useState(null);
  const [categoryChartData, setCategoryChartData] = useState(null);
  const [priceDistributionChartData, setPriceDistributionChartData] = useState(null);
  const [averagePrice, setAveragePrice] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('/api/visualization');
        setVendorChartData(response.data.vendorChartData);
        setCategoryChartData(response.data.categoryChartData);
        setPriceDistributionChartData(response.data.priceDistributionChartData);
        setAveragePrice(response.data.averagePrice);
      } catch (error) {
        console.error('Error fetching visualization data:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <div>
      <h2>Top Vendors by Product Count</h2>
      {vendorChartData && <Bar data={vendorChartData} />}
      
      <h2>Top Categories by Product Count</h2>
      {categoryChartData && <Bar data={categoryChartData} />}
      
      <h2>Price Distribution</h2>
      {priceDistributionChartData && <Bar data={priceDistributionChartData} />}
      
      <h2>Average Price</h2>
      {averagePrice && <p>{averagePrice}</p>}
    </div>
  );
};

export default VisualizationComponent;