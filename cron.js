module.exports = function(app, conn) {
  var cron = require('node-cron');
  var route = require('express').Router();
  var async = require('async');
  var request = require('request');

  cron.schedule('0 0 * * *', function() {
    console.log('cron started', getFullFormatDate(new Date()));
    var url = '';
    if ('development' == app.get('env')) {
      var url = 'http://localhost:3000/cron/updateProgress/feed100by410';
    }
    else if ('production' == app.get('env')) {
        var url = 'http://sample-env.q59pvjygde.ap-northeast-2.elasticbeanstalk.com/cron/updateProgress/feed100by410';
    }
    request(url, function (error, response, body) {
      if(error) {
        console.log('cron error:', error); // Print the error if one occurred
      }
    });
  }).start();


  route.get('/admin/projects/', function(req, res, next) {
    var sql = 'SELECT * FROM projects LEFT JOIN companies ON projects.cid = companies.cid ORDER BY pid DESC';
    conn.read.query(sql, function(err, results) {
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        res.send(results);
      }
    });
  });

  route.get('/resetUpdateDate/:pwd/:pid', function(req, res, next) {
    if(req.params.pwd == 'feed100by410') {
      var sql = 'UPDATE testHistory SET scoreUpdateDate = NULL, rewardUpdateDate = NULL WHERE pid = ?';
      conn.write.query(sql, req.params.pid, function(err, results) {
        res.send(results);
      });
    }
    else {
      res.send('누구세요');
    }
  });

  route.get('/startProject/:pwd/:pid/:offset', function(req, res, next) {
    if(req.params.pwd == 'feed100by410') {
      var sql = 'SELECT * FROM projects WHERE pid = ?';
      conn.read.query(sql, req.params.pid, function(err, results) {
        if(err) {
          console.log(err);
          return next(err);
        }
        else {
          var today = getFullFormatSharpDate(new Date());
          var startDate = getFullFormatDate(addDays(today, Number(req.params.offset)));
          var period = JSON.parse(results[0].period);
          for(var i=0; i<period.length; i++) {
            if(i == 0) {
              period[i].startDate = new Date(startDate);
            }
            else {
              period[i].startDate = new Date(addDays(period[i-1].startDate, period[i-1].period));
            }
          }
          for(var i=0; i<period[3].reports.length; i++) {
            if(i == 0) {
              period[3].reports[i].startDate = new Date(period[3].startDate);
            }
            else {
              period[3].reports[i].startDate = new Date(addDays(period[3].reports[i-1].startDate, period[3].reports[i-1].period));
            }
          }
          period = JSON.stringify(period);
          var sql = 'UPDATE projects SET startDate = ?, period = ? WHERE pid = ?';
          conn.write.query(sql, [startDate, period, req.params.pid], function(err, results) {
            if(err) {
              console.log(err);
              return next(err);
            }
            else {
              var output = '';
              output += 'pid : ' + req.params.pid;
              output += '<br>'
              output += 'startDate : ' + startDate;
              output += '<br>'
              output += 'period : ' + period;
              res.send(output);
            }
          });
        }
      });
    }
    else {
      res.send('누구세요');
    }
  });

  route.get('/updateProgress/:pwd', function(req, res, next) {
    if(req.params.pwd == 'feed100by410') {
      var output = { output: '' };
      async.waterfall([
      function(callback) {
        conn.write.beginTransaction(function(err) {
          if(err) {
            callback(err);
          }
          else {
            callback(null, 'one', 'two');
          }
        });
      },
      function(arg1, arg2, callback) {
        updateProgress(callback, output);
      }
      ], function (err, result) {
        if(err) {
          rollback(next, err);
        }
        else {
          conn.write.commit(function(err) {
            if(err) {
              rollback(next, err);
            }
            else {
              console.log('=========== updateProgress success', getFullFormatDate(new Date()));
              output.output = output.output + '=========== updateProgress success ' + getFullFormatDate(new Date());
              output.output = output.output + "<br>";
              updateReward(next, res, output);
              // res.send(output.output);
            }
          });
        }
      });
    }
    else {
      res.send('누구세요');
    }
  });

  route.get('/updateReward/:pwd', function(req, res, next) {
    if(req.params.pwd == 'feed100by410') {
      updateReward(next);
    }
  });

  function updateReward(next, res, output) {
    async.waterfall([
    function(callback) {
      conn.write.beginTransaction(function(err) {
        if(err) {
          callback(err);
        }
        else {
          callback(null);
        }
      });
    },
    function(callback) {
      var sql = 'SELECT * FROM projects WHERE progressState = ?';
      conn.read.query(sql, '진행중', function(err, results) {
        if(err) {
          callback(err);
        }
        else {
          callback(null, results);
        }
      });
    },
    function(_results, callback) {
      async.each(_results, function(result, done) {
        if('종료' == getProgressState(result.period).state) {
          var sql = 'SELECT * FROM testHistory WHERE pid = ? ORDER BY score DESC';
          conn.read.query(sql, result.pid, function(err, results) {
            if(err) {
              callback(err);
            }
            else {
              var goldCount = result.goldCount;
              var silverCount = result.silverCount;
              var bronzeCount = result.bronzeCount;

              var reward_gold = result.reward_gold;
              var reward_silver = result.reward_silver;
              var reward_bronze = result.reward_bronze;
              var reward_normal = result.reward_normal;
              async.each(results, function(result, _done) {
                var reward = {
                  ranking: results.indexOf(result)+1,
                  point: 0,
                  trophy: '',
                  experiencePoint: 0,
                }
                if(reward.ranking <= goldCount) {
                  reward.point = reward_gold;
                  reward.trophy = 'gold';
                  reward.experiencePoint = reward_gold / 100;
                }
                else if(reward.ranking <= goldCount + silverCount) {
                  reward.point = reward_silver;
                  reward.trophy = 'silver';
                  reward.experiencePoint = reward_silver / 100;
                }
                else if(reward.ranking <= goldCount + silverCount + bronzeCount) {
                  reward.point = reward_bronze;
                  reward.trophy = 'bronze';
                  reward.experiencePoint = reward_bronze / 100;
                }
                else {
                  reward.point = reward_normal;
                  reward.trophy = 'normal';
                  reward.experiencePoint = reward_normal / 100;
                }
                var sql = 'UPDATE testHistory SET ranking = ?, point = ?, trophy = ?, experiencePoint = ?, rewardUpdateDate = now() WHERE tid = ? and pid = ? and (rewardUpdateDate is NULL or DATEDIFF(rewardUpdateDate, now()) != 0)';
                conn.write.query(sql, [reward.ranking, reward.point, reward.trophy, reward.experiencePoint, result.tid, result.pid], function(err, results) {
                  if(err) {
                    callback(err);
                  }
                  else {
                    if(results.changedRows == 0) {
                      console.log('reward update - tid :', result.tid, 'pid', result.pid, reward.ranking, reward.point, reward.trophy, reward.experiencePoint);
                      console.log('실패 - 오늘 이미 수정되었습니다.');
                      output.output = output.output + 'reward update - tid : ' + result.tid + ' pid ' + result.pid + " " + reward.ranking + " " + reward.point + " " + reward.trophy + " " + reward.experiencePoint;
                      output.output = output.output + "<br>";
                      output.output = output.output + '실패 - 오늘 이미 수정되었습니다.';
                      output.output = output.output + "<br><br>";
                    }
                    else {
                      console.log('reward update - tid :', result.tid, 'pid', result.pid, reward.ranking, reward.point, reward.trophy, reward.experiencePoint);
                      output.output = output.output + 'reward update - tid : ' + result.tid + ' pid ' + result.pid + " " + reward.ranking + " " + reward.point + " " + reward.trophy + " " + reward.experiencePoint;
                      output.output = output.output + "<br><br>";
                    }
                    _done();
                  }
                });
              }, function(err) {
                if(err) {
                  callback(err);
                }
                else {
                  updateProgressState(result.pid, result.progressState, getProgressState(result.period).state, callback, done, output);
                }
              });
            }
          });
        }
        else {
          done();
        }
      }, function(err) {
        if(err) {
          callback(err);
        }
        else {
          callback(null, 'done');
        }
      });
    }
    ], function (err, result) {
      if(err) {
        rollback(next, err);
      }
      else {
        conn.write.commit(function(err) {
          if(err) {
            rollback(next, err);
          }
          else {
            console.log('=========== updateReward success', getFullFormatDate(new Date()));
            output.output = output.output + '=========== updateReward success ' + getFullFormatDate(new Date());
            output.output = output.output + "<br>";
            res.send(output.output);
          }
        });
      }
    });

  }

  function updateProgress(callback, output) {
    var sql = 'SELECT * FROM projects WHERE progressState != ?';
    conn.read.query(sql, '종료', function(err, results) {
      if(err) {
        callback(err);
      }
      else {
        async.each(results, function(result, done) {
          var progressState = getProgressState(result.period).state;
          switch(result.progressState) {
            case '결제대기중':
            if(progressState == '대기중') {
              updateProgressState(result.pid, result.progressState, progressState, callback, done, output);
            }
            else {
              done();
            }
            break;

            case '대기중':
            if(progressState == '모집중') {
              updateProgressState(result.pid, result.progressState, progressState, callback, done, output);
            }
            else {
              done();
            }
            break;

            case '모집중':
            if(progressState == '선정중') {
              async.waterfall([
              function(_callback) {
                // 테스터 선정(checked)
                var sql = `
                UPDATE testHistory SET checked = 1 WHERE tid in (SELECT tid FROM
                (SELECT testHistory.tid, accuracyRate, @rank := @rank+1 as rank, projects.numOfRecruitment
                FROM (testHistory, (SELECT @rank := 0) as r)
                LEFT JOIN projects ON testHistory.pid = projects.pid
                WHERE testHistory.pid = ? ORDER BY accuracyRate DESC, testHistory.tid)
                as t WHERE rank <= numOfRecruitment)
                `;
                conn.write.query(sql, result.pid, function(err, results) {
                  if(err) {
                    console.log(err);
                  }
                  else {
                    console.log("pid : " + result.pid, "select testers", results);
                    output.output = output.output + "pid : " + result.pid + " select testers" + results;
                    output.output = output.output + "<br>";
                    _callback(null, 'done');
                  }
                });
              },
              ], function (err, _result) {
                if(err) {
                  console.log(err);
                }
                else {
                  updateProgressState(result.pid, result.progressState, progressState, callback, done, output);
                }
              });
            }
            else {
              done();
            }
            break;

            case '선정중':
            if(progressState == '진행중') {
              async.waterfall([
              function(_callback) {
                // 선정(checked)된 테스터를 제외하고 모두 제거
                conn.write.beginTransaction(function(err) {
                  if (err) {
                    console.log(err);
                    return next(err);
                  }
                  else {
                    var sql = 'DELETE FROM testHistory WHERE pid = ? and checked = 0';
                    conn.write.query(sql, result.pid, function(err, results) {
                      if(err) {
                        rollback(next, err);
                      }
                      else {
                        var sql = 'UPDATE projects SET numOfApplicant = numOfApplicant - ? WHERE pid = ?';
                        conn.write.query(sql, [results.affectedRows, result.pid], function(err, results) {
                          if(err) {
                            rollback(next, err);
                          }
                          else {
                            conn.write.commit(function(err) {
                              if(err) {
                                rollback(next, err);
                              }
                              else {
                                console.log("pid : " + result.pid, "delete testers", results);
                                output.output = output.output + "pid : " + result.pid + " delete testers" + results;
                                output.output = output.output + "<br>";
                                _callback(null, 'done');
                              }
                            });
                          }
                        });
                      }
                    });
                  }
                });
              },
              ], function (err, _result) {
                if(err) {
                  console.log(err);
                }
                else {
                  updateProgressState(result.pid, result.progressState, progressState, callback, done, output);
                }
              });
            }
            else {
              done();
            }
            break;

            case '진행중':
            if(progressState != '결제대기중') {
              // 보고서 마감하면 점수 및 보고서 집계
              var startDateArray = getStartDateArray(result.period);
              var proceedingReport = getProceedingReport(result.period);
              var yesterdayProceedingReport = getYesterdayProceedingReport(result.period);
              console.log(yesterdayProceedingReport, proceedingReport);
              if(yesterdayProceedingReport!= '' && proceedingReport != '' && (yesterdayProceedingReport.split('차 ')[1] == '보고서' && proceedingReport.split('차 ')[1] == '점검')) {
                console.log(yesterdayProceedingReport, proceedingReport);
                calculateCount(result.pid, JSON.parse(result.reports), result.reportCount, yesterdayProceedingReport, callback, done, output);
              }
              else {
                done();
              }
              break;
            }
            else {
              done();
            }

          }
        }, function(err) {
            if(err) {
              callback(err);
            }
            else {
              callback(null, 'done');
            }
        });
      }
    });
  }

  function updateProgressState(pid, preProgressState, progressState, callback, done, output) {
    var sql = 'UPDATE projects SET progressState = ?, progressUpdateDate = now() WHERE pid = ?';
    conn.write.query(sql, [progressState, pid], function(err, results) {
      if(err) {
        callback(err);
      }
      else {
        console.log("pid : " + pid, preProgressState, "->", progressState);
        output.output = output.output + "pid : " + pid + " " + preProgressState + " -> " + progressState;
        output.output = output.output + "<br>";
        done();
      }
    });
  }

  function calculateCount(pid, reports, reportCount, yesterdayProceedingReport, _callback, done, output) {
    async.waterfall([
    function(callback) {
      var sql = 'SELECT * FROM testHistory WHERE pid = ?';
      conn.read.query(sql, pid, function(err, results) {
        if(err) {
          callback(err);
        }
        else {
          var maxScore = 0;

          var report = reports;
          report = report[yesterdayProceedingReport.split('차 ')[0]-1];
          // count 0으로 초기화
          report.submitCount = 0;
          for(var j=0; j<report.questions.length; j++) {
            if(report.questions[j].category == 'objective') {
              for(var k=0; k<report.questions[j].options.length; k++) {
                report.questions[j].options[k].count = 0;
              }
            }
          }

          var myScore = [];
          for(var i=0; i<results.length; i++) {
            var tid = results[i].tid;
            var _report = JSON.parse(results[i].report);
            _report = _report[yesterdayProceedingReport.split('차 ')[0]-1];
            if(_report.title) { // 보고서 제출 했으면
              //submitCount 증가
              report.submitCount = report.submitCount + 1;

              var _myScore = 0;
              for(var j=0; j<report.questions.length; j++) {
                if(report.questions[j].category == 'objective') {
                  // option count 증가
                  report.questions[j].options[_report.questions[j].answer-1].count = report.questions[j].options[_report.questions[j].answer-1].count + 1;
                }
                else if(report.questions[j].category == 'subjective') {
                  _myScore = _myScore + ( (_report.questions[j].score) ? _report.questions[j].score : 0 );
                }
              }
              myScore.push({
                tid: tid,
                _myScore: _myScore
              });
              if(_myScore >= maxScore) {
                maxScore = _myScore;
              }
            }
            else { // 제출 안했으면 0점
              myScore.push({
                tid: tid,
                _myScore: 0
              });
            }
          }

          var _reports = reports;
          _reports[yesterdayProceedingReport.split('차 ')[0]-1] = report;
          _reports = JSON.stringify(_reports);

          var maxReportScore = 900;
          var maxThisReportScore = ((maxReportScore / reportCount) / 2).toFixed(0);
          var testHistories = results;
          callback(null, myScore, maxScore, maxThisReportScore, testHistories, _reports, pid);
        }
      });
    },
    function(myScore, maxScore, maxThisReportScore, testHistories, reports, pid, callback) {
      // testHistory Score Update
      async.each(testHistories, function(testHistory, done) {
        var score = 0;
        if(maxScore == 0) {
          score = ((myScore.find(function(d) {return d.tid === testHistory.tid})._myScore) * maxThisReportScore).toFixed(1);
        }
        else {
          score = ((myScore.find(function(d) {return d.tid === testHistory.tid})._myScore / maxScore) * maxThisReportScore).toFixed(1);
        }
        var sql = 'UPDATE testHistory SET score = score + ?, scoreUpdateDate = now() WHERE tid = ? and pid = ? and (scoreUpdateDate is NULL or DATEDIFF(scoreUpdateDate, now()) != 0)';
        conn.write.query(sql, [score, testHistory.tid, pid], function(err, results){
          if(err) {
            callback(err);
          }
          else {
            if(results.changedRows == 0) {
              console.log('score update - tid :', testHistory.tid, 'pid', pid, 'score', score);
              console.log('실패 - 오늘 이미 수정되었습니다.');
              output.output = output.output + 'score update - tid : ' + testHistory.tid + ' pid ' + pid + ' score ' + score;
              output.output = output.output + "<br>";
              output.output = output.output + '실패 - 오늘 이미 수정되었습니다.';
              output.output = output.output + "<br><br>";
            }
            else {
              console.log('score update - tid :', testHistory.tid, 'pid', pid, 'score', score);
              output.output = output.output + 'score update - tid : ' + testHistory.tid + ' pid ' + pid + ' score ' + score;
              output.output = output.output + "<br><br>";
            }
            done();
          }
        });

      }, function(err) {
        if(err) {
          callback(err);
        }
        else {
          callback(null, reports, pid);
        }

      });
    },
    function(reports, pid, callback) {
      // projects reports Update
      var sql = 'UPDATE projects SET reports = ?, progressUpdateDate = now() WHERE pid = ?';
      conn.write.query(sql, [reports, pid], function(err, results){
        if(err) {
          callback(err);
        }
        else {
          console.log('projects reports update - pid :', pid);
          output.output = output.output + 'projects reports update - pid : ' + pid;
          output.output = output.output + "<br>";
          callback(null, 'done');
        }
      });
    }
    ], function (err, result) {
      if(err) {
        _callback(err);
      }
      else {
        done();
      }
    });
  }

  function getProgressState(period) {
    var today = new Date();
    var period = JSON.parse(period);
    var stateClass = ['label-info', 'label-success', 'label-warning', 'label-danger', 'label-default'];
    if(period[0].startDate == '' || today < new Date(period[0].startDate)) {
      return {state:'결제 대기중', class:''};
    }
    else {
      for(var i=0; i<period.length; i++) {
        if(period[i+1] && today < new Date(period[i+1].startDate)) {
          return {state:period[i].progress, class:stateClass[i]};
        }
        else if(today >= new Date(period[4].startDate)) {
          return {state:period[4].progress, class:stateClass[4]};
        }
      }
    }
  }

  function getStartDateArray(period) {
    var period = JSON.parse(period);
    var startDateArray = new Array();
    for(var i=0; i<period.length; i++) {
      startDateArray[i] = period[i].startDate;
    }
    return startDateArray;
  }

  function getProceedingReport(period) {
    var today = new Date();
    var period = JSON.parse(period);
    if(today < new Date(period[3].startDate)) {
      return '';
    }
    for(var i=0; i<period[3].reports.length; i++) {
      if(period[3].reports[i+1] && today < new Date(period[3].reports[i+1].startDate)) {
        return period[3].reports[i].progress;
      }
      else if((i+1) == period[3].reports.length) {
        if(today < new Date(period[4].startDate)) {
          return period[3].reports[i].progress;
        }
      }
    }
    return '';
  }

  function getYesterdayProceedingReport(period) {
    var today = new Date();
    var period = JSON.parse(period);
    if(today < new Date(period[3].startDate)) {
      return '';
    }
    for(var i=0; i<period[3].reports.length; i++) {
      if(period[3].reports[i+1] && addDays(today, -1) < new Date(period[3].reports[i+1].startDate)) {
        return period[3].reports[i].progress;
      }
      else if((i+1) == period[3].reports.length) {
        if(addDays(today, -1) < new Date(period[4].startDate)) {
          return period[3].reports[i].progress;
        }
      }
    }
    return '';
  }

  function getFullFormatDate(date) {
      var year = date.getFullYear(); //yyyy
      var month = (1 + date.getMonth()); //M
      month = month >= 10 ? month : '0' + month;  // month 두자리로 저장
      var day = date.getDate(); //d
      day = day >= 10 ? day : '0' + day; //day 두자리로 저장
      var hour = date.getHours();
      hour = hour >= 10 ? hour: '0' + hour;
      var minute = date.getMinutes();
      minute = minute >= 10 ? minute : '0' + minute; //minute 두자리로 저장
      var second = date.getSeconds();
      second = second >= 10 ? second : '0' + second;
      return year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second;
  }

  function getFullFormatSharpDate(date) {
      var year = date.getFullYear(); //yyyy
      var month = (1 + date.getMonth()); //M
      month = month >= 10 ? month : '0' + month;  // month 두자리로 저장
      var day = date.getDate(); //d
      day = day >= 10 ? day : '0' + day; //day 두자리로 저장
      return year + '-' + month + '-' + day + ' ' + '00:00:00';
  }

  function addDays(date, days) {
      var result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
  }

  function rollback(next, err) {
    conn.write.rollback(function() {
      console.log('rollback', err);
      return next(err);
    });
  }

  return route;
};
