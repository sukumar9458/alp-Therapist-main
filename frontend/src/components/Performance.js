import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import axios from 'axios';
import config from '../config';
import '../styles/Performance.css';

// Register ChartJS components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale
);

function Performance() {
  const [quizHistory, setQuizHistory] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalSubtopics: 0,
    completedSubtopics: 0,
    overallProgress: 0,
    highestLevel: 0,
    overallPerformance: 0,
    averageScore: 0
  });
  const [subjectStats, setSubjectStats] = useState({});

  // Add performance calculation function
  const calculatePerformanceScore = (level, score) => {
    if (level >= 8) { // Hard level
      if (score < 50) return 75; // Consider as 75% in standard level
      return score;
    } else if (level >= 5) { // Standard level
      return score;
    } else { // Easy level
      if (score >= 80) return 40; // Consider as 40% in standard level
      return score * 0.5; // Scale down the score for easy level
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Authentication required');
          return;
        }

        // Fetch subjects
        const subjectsResponse = await axios.get(`${config.apiBaseUrl}/subjects`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (subjectsResponse.data) {
          setSubjects(subjectsResponse.data);
        }

        // Fetch quiz history
        const historyResponse = await axios.get(`${config.apiBaseUrl}/quiz-history`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (historyResponse.data && historyResponse.data.quizHistory) {
          const quizHistory = historyResponse.data.quizHistory;
          setQuizHistory(quizHistory);
          
          // Calculate subject-wise statistics
          const subjectProgress = {};
          let totalSubtopics = 0;
          let completedSubtopics = 0;
          let totalPerformanceScore = 0;
          let totalQuizzes = 0;

          subjectsResponse.data.forEach(subject => {
            const subjectQuizzes = quizHistory.filter(
              quiz => quiz.subjectName === subject.name
            );

            // Only process subjects that have been attempted
            if (subjectQuizzes.length > 0) {
              const subtopicProgress = {};
              let subjectPerformanceScores = [];

              subject.subtopics.forEach(subtopic => {
                const subtopicQuizzes = subjectQuizzes.filter(
                  quiz => quiz.subtopicName === subtopic.name
                );

                if (subtopicQuizzes.length > 0) {
                  // Find the highest level achieved for this subtopic
                  const highestLevelQuiz = subtopicQuizzes.reduce((highest, quiz) => {
                    return (quiz.nextLevel > highest.nextLevel) ? quiz : highest;
                  }, subtopicQuizzes[0]);

                  // Check if subtopic is completed (level 8 with 80%+ score)
                  const isCompleted = highestLevelQuiz.nextLevel >= 8 && highestLevelQuiz.score >= 80;
                  
                  // Calculate performance scores for each quiz in this subtopic
                  const subtopicPerformanceScores = subtopicQuizzes.map(quiz => 
                    calculatePerformanceScore(quiz.nextLevel, quiz.score)
                  );
                  
                  // Add these performance scores to the subject's total
                  subjectPerformanceScores = [...subjectPerformanceScores, ...subtopicPerformanceScores];
                  
                  subtopicProgress[subtopic.name] = {
                    completed: isCompleted,
                    level: highestLevelQuiz.nextLevel,
                    score: highestLevelQuiz.score
                  };

                  if (isCompleted) {
                    completedSubtopics++;
                  }
                  totalSubtopics++;
                }
              });

              // Calculate subject completion percentage and performance
              const subjectCompletedSubtopics = Object.values(subtopicProgress).filter(
                progress => progress.completed
              ).length;
              const subjectTotalSubtopics = Object.keys(subtopicProgress).length;
              
              // Calculate subject performance as average of all quiz performance scores
              const subjectAverageScore = subjectPerformanceScores.length > 0
                ? Math.round(subjectPerformanceScores.reduce((sum, score) => sum + score, 0) / subjectPerformanceScores.length)
                : 0;
              
              // Add subject's performance scores to the total
              totalPerformanceScore += subjectPerformanceScores.reduce((sum, score) => sum + score, 0);
              totalQuizzes += subjectPerformanceScores.length;
              
              subjectProgress[subject.name] = {
                completed: subjectCompletedSubtopics,
                total: subjectTotalSubtopics,
                percentage: Math.round((subjectCompletedSubtopics / subjectTotalSubtopics) * 100),
                averageScore: subjectAverageScore,
                subtopicProgress
              };
            }
          });
          
          setSubjectStats(subjectProgress);
          
          // Calculate overall progress and average score
          const overallPercentage = totalSubtopics > 0 
            ? Math.round((completedSubtopics / totalSubtopics) * 100)
            : 0;
          
          const overallAverageScore = totalQuizzes > 0
            ? Math.round(totalPerformanceScore / totalQuizzes)
            : 0;
          
          setStats({
            totalSubtopics: totalSubtopics,
            completedSubtopics: completedSubtopics,
            overallProgress: overallPercentage,
            averageScore: overallAverageScore,
            highestLevel: Math.max(...quizHistory.map(quiz => quiz.nextLevel))
          });
        }
      } catch (err) {
        setError('Failed to fetch data');
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const createChartData = (completed, total) => ({
    labels: ['Completed', 'Remaining'],
    datasets: [
      {
        data: [completed, total - completed],
        backgroundColor: [
          '#4CAF50',
          '#E0E0E0'
        ],
        borderColor: [
          '#4CAF50',
          '#E0E0E0'
        ],
        borderWidth: 1,
      },
    ],
  });

  const createScoreChartData = (score) => ({
    labels: ['Score', 'Remaining'],
    datasets: [
      {
        data: [score, 100 - score],
        backgroundColor: [
          '#2563eb',
          '#E0E0E0'
        ],
        borderColor: [
          '#2563eb',
          '#E0E0E0'
        ],
        borderWidth: 1,
      },
    ],
  });

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: false
      }
    },
    cutout: '95%'
  };

  if (loading) {
    return <div className="loading">Loading performance data...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="performance-container">
      <div className="performance-header">
        <h1>Performance Overview</h1>
      </div>
      
      <div className="performance-content">
        <div className="performance-block">
          <h2>Progress Analysis</h2>
          <div className="performance-content">
            <div className="overall-performance">
              <h3>Overall Progress</h3>
              <div className="chart-container">
                <div className="chart-wrapper">
                  <Doughnut 
                    data={createChartData(stats.overallProgress, 100)} 
                    options={chartOptions} 
                  />
                  <div className="chart-center-text">
                    <span className="percentage">{stats.overallProgress}%</span>
                    <span className="label">Completed</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="subject-performance">
              <h3>Subject-wise Progress</h3>
              <div className="subject-charts-grid">
                {subjects
                  .filter(subject => subjectStats[subject.name]?.total > 0)
                  .map(subject => (
                  <div key={`prog-${subject._id}`} className="subject-chart-card">
                    <h4>{subject.name}</h4>
                    <div className="chart-container">
                      <div className="chart-wrapper">
                        <Doughnut 
                          data={createChartData(
                            subjectStats[subject.name]?.completed || 0,
                            subjectStats[subject.name]?.total || 1
                          )} 
                          options={chartOptions} 
                        />
                        <div className="chart-center-text">
                          <span className="percentage">
                            {subjectStats[subject.name]?.percentage || 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="subject-stats">
                      <p>Completed: {subjectStats[subject.name]?.completed || 0}/{subjectStats[subject.name]?.total || 0} topics</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="performance-block">
          <h2>Performance Analysis</h2>
          <div className="performance-content">
            <div className="overall-performance">
              <h3>Overall Performance</h3>
              <div className="chart-container">
                <div className="chart-wrapper">
                  <Doughnut 
                    data={createScoreChartData(stats.averageScore)} 
                    options={chartOptions} 
                  />
                  <div className="chart-center-text">
                    <span className="percentage">{stats.averageScore}%</span>
                    <span className="label">Average Score</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="subject-performance">
              <h3>Subject-wise Performance</h3>
              <div className="subject-charts-grid">
                {subjects
                  .filter(subject => subjectStats[subject.name]?.total > 0)
                  .map(subject => (
                  <div key={`perf-${subject._id}`} className="subject-chart-card">
                    <h4>{subject.name}</h4>
                    <div className="chart-container">
                      <div className="chart-wrapper">
                        <Doughnut 
                          data={createScoreChartData(
                            subjectStats[subject.name]?.averageScore || 0
                          )} 
                          options={chartOptions} 
                        />
                        <div className="chart-center-text">
                          <span className="percentage">
                            {subjectStats[subject.name]?.averageScore || 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="subject-stats">
                      <p>Average Score: {subjectStats[subject.name]?.averageScore || 0}%</p>
                      <p>Highest Level: {Math.max(...Object.values(subjectStats[subject.name]?.subtopicProgress || {}).map(p => p.level || 0))}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Performance; 