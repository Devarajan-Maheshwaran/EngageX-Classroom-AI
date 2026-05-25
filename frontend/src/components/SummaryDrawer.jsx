import React from 'react';

const SummaryDrawer = ({ isOpen, onClose, summaryData, onDownloadPdf }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-gray-900 border-l border-gray-700 shadow-xl z-50 overflow-y-auto transform transition-transform duration-300 ease-in-out">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Session Summary</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {summaryData ? (
          <div className="space-y-6">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-sm text-gray-400 uppercase font-semibold mb-2">Class Average</h3>
              <p className="text-3xl text-white font-bold">{summaryData.class_avg_engagement || 'N/A'}/100</p>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-sm text-gray-400 uppercase font-semibold mb-2">Total Alerts</h3>
              <p className="text-xl text-white">{summaryData.alerts_total}</p>
            </div>

            <button 
              onClick={onDownloadPdf}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors"
            >
              Generate Full PDF Report
            </button>
          </div>
        ) : (
          <div className="flex justify-center items-center h-48">
            <p className="text-gray-400">Loading summary...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryDrawer;
