module.exports = function(conn) {
  var route = require('express').Router();
  var formidable = require('formidable');
  var AWS = require('aws-sdk');
  AWS.config.region = 'ap-northeast-2';

  route.post('/upload/:folder', function(req, res, next) {
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files){
        var s3 = new AWS.S3();
        var params = {
             Bucket:'elasticbeanstalk-ap-northeast-2-035223481599',
             Key:req.params.folder+'/'+(+new Date())+files.ex_filename.name,
             ACL:'public-read',
             Body: require('fs').createReadStream(files.ex_filename.path)
        }
        if(files.ex_filename.size != 0) {
          s3.upload(params, function(err, data){
            var result='';
            if(err) {
              console.log(err);
               return next(err);
            }
            else {
              result = data.Location;
              res.send(result);
            }
          });
        }
        else {
          res.send('');
        }

    });
  });

  route.post('/move', function(req, res, next) {
    var sliceUrl = req.body.img.split('/tmp/');
    sliceUrl = decodeURIComponent(sliceUrl[1]);
    var s3 = new AWS.S3();
    var params = {
         Bucket:'elasticbeanstalk-ap-northeast-2-035223481599',
         CopySource:req.body.img,
         Key:'images/'+sliceUrl,
         ACL:'public-read',
    };
    s3.copyObject(params, function(err, data){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        var params = {
             Bucket:'elasticbeanstalk-ap-northeast-2-035223481599',
             Key:'tmp/'+sliceUrl,
        }
        s3.deleteObject(params, function(err, data){
          if(err) {
            console.log(err);
            return next(err);
          }
          else {
            res.send(req.body.img);
          }
        });
      }
    });
  });

  route.get('/users', function(req, res, next) {
    if(req.session.passport.user.uid) {
      var sql = 'SELECT * FROM users LEFT JOIN levels ON users.level = levels.level WHERE uid = ?';
      conn.read.query(sql, [req.session.passport.user.uid], function(err, results){
        if(err) {
          console.log(err);
          return next(err);
        }
        else {
          res.send(results);
        }
      });
    }
    else if(req.session.passport.user.cid) {
      res.redirect('/api/companies');
    }
  });

  route.get('/companies', function(req, res, next) {
    var sql = 'SELECT * FROM companies WHERE cid = ?';
    conn.read.query(sql, [req.session.passport.user.cid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        res.send(results);
      }
    });
  });

  route.post('/check/:value/:tid/:pid', function(req, res, next) {
    if(Number(req.params.value) == 1) {
      var sql = 'SELECT count(*) as checkedTesterCount,(SELECT numOfRecruitment FROM projects WHERE pid = ?) as numOfRecruitment FROM testHistory WHERE checked =1 and pid = ?';
      conn.read.query(sql, [req.params.pid, req.params.pid], function(err, results) {
        if(err) {
          console.log(err);
          return next(err);
        }
        else {
          if(results[0].checkedTesterCount < results[0].numOfRecruitment) {
            var sql = 'UPDATE testHistory SET checked = 1 WHERE tid = ?';
            conn.write.query(sql, [req.params.tid], function(err, results){
              if(err) {
                console.log(err);
                return next(err);
              }
              else {
                res.send('1');
              }
            });
          }
          else {
            res.send('0');
          }
        }
      });
    }
    else {
      var sql = 'UPDATE testHistory SET checked = 0 WHERE tid = ?';
      conn.write.query(sql, [req.params.tid], function(err, results){
        if(err) {
          console.log(err);
          return next(err);
        }
        else {
          res.send('1');
        }
      });
    }
  });

  route.get('/test-history', function(req, res, next) {
    var sql = 'SELECT * FROM testHistory LEFT JOIN projects ON testHistory.pid = projects.pid LEFT JOIN companies ON projects.cid = companies.cid WHERE uid = ? ORDER BY testHistory.tid DESC';
    conn.read.query(sql, [req.session.passport.user.uid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        res.send(results);
      }
    });
  });

  route.get('/test-history/:pid', function(req, res, next) {
    var sql = `SELECT *, s.lastCheckedNoticeCount, s.lastCheckedForumCount, s.lastCheckedQuestionCount FROM
    (SELECT *,@rank := @rank+1 AS rank FROM testHistory AS t, (SELECT @rank := 0) AS r WHERE pid = ? ORDER BY score DESC, accuracyRate DESC, tid)
    AS s LEFT JOIN projects ON s.pid = projects.pid WHERE s.pid = ? and uid = ?`;
    conn.read.query(sql, [req.params.pid, req.params.pid, req.session.passport.user.uid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        res.send(results);
      }
    });
  });

  route.post('/test-history/:pid', function(req, res, next) {
    var sql = 'SELECT * FROM projects WHERE pid = ?';
    conn.read.query(sql, [req.params.pid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        if(results[0].progressState != '모집중') {
          res.send('이 프로젝트는 현재 모집중이 아닙니다');
        }
        else {
          if(results[0].numOfApplicant < (results[0].numOfRecruitment) * 2) {
            conn.write.beginTransaction(function(err) {
              if (err) {
                console.log(err);
                return next(err);
              }
              else {
                var report = [];
                var reportQuestion = [];
                for(var i=0; i<results[0].reportCount; i++) {
                  report.push({});
                  reportQuestion.push({});
                }
                var user = req.session.passport.user;
                var accuracyRate = getAccuracyRate(user.age, user.gender, user.interestFields, user.job, user.region, results[0].conditions);
                var sql = 'INSERT INTO testHistory SET uid = ?, pid = ?, report = ?, reportQuestion = ?, accuracyRate = ?, questionAnswer = ?';
                conn.write.query(sql, [req.session.passport.user.uid, req.params.pid, JSON.stringify(report), JSON.stringify(reportQuestion), accuracyRate, req.body.questionAnswer], function(err, results){
                  if(err) {
                    rollback(next, err);
                  }
                  else {
                    var sql = 'UPDATE projects SET numOfApplicant = numOfApplicant + 1 WHERE pid = ?';
                    conn.write.query(sql, [req.params.pid], function(err, results) {
                      if(err) {
                        rollback(next, err);
                      }
                      else {
                        conn.write.commit(function(err) {
                          if(err) {
                            rollback(next, err);
                          }
                          else {
                            res.send('신청되었습니다.');
                          }
                        });
                      }
                    });
                  }
                });
              }
            });
          }
          else {
            res.send('모집 인원이 초과되었습니다.');
          }
        }
      }
    });
  });

  route.post('/reportQuestion/:tid', function(req, res, next) {
    var sql = 'SELECT * FROM testHistory LEFT JOIN projects ON testHistory.pid = projects.pid WHERE tid = ?';
    conn.read.query(sql, [req.params.tid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        var reportQuestion = JSON.parse(results[0].reportQuestion);
        if(reportQuestion[Number(req.body.title)-1].question) {
          res.send('이미 질문을 남기셨습니다.');
        }
        else {
          reportQuestion[Number(req.body.title)-1] = {
            title : Number(req.body.title),
            question : req.body.reportQuestion,
            answer : ''
          };
          var maxReportScore = 900;
          var maxThisReportScore = ((maxReportScore / results[0].reportCount) / 2).toFixed(0);
          var sql = 'UPDATE testHistory SET score = score + ?, reportQuestion = ? WHERE tid = ?';
          conn.write.query(sql, [Number(maxThisReportScore), JSON.stringify(reportQuestion), req.params.tid], function(err, results) {
            if(err) {
              console.log(err);
              return next(err);
            }
            else {
              res.send(results);
            }
          });
        }
      }
    });
  });

  route.post('/reportQuestionAnswer/:tid', function(req, res, next) {
    var sql = 'UPDATE testHistory SET reportQuestion = ? WHERE tid = ?';
    conn.write.query(sql, [req.body.reportQuestion, req.params.tid], function(err, results) {
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        res.send(results);
      }
    });
  });

  route.post('/report/:pid', function(req, res, next) {
    var sql = 'SELECT * FROM testHistory LEFT JOIN projects ON testHistory.pid = projects.pid WHERE uid = ? and testHistory.pid = ?';
    conn.read.query(sql, [req.session.passport.user.uid, req.params.pid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        if(results[0]) {
          var testHistoryResult = results[0];
          var originalReport = (testHistoryResult.report) ? JSON.parse(testHistoryResult.report) : [];
          if(originalReport.length == 0) {
            for(var i=0; i<testHistoryResult.reportCount; i++) {
              originalReport.push({});
            }
          }
          var newReport = JSON.parse(req.body.reportData);
          var title = newReport.title;
          var titleNumber = title.split('차 보고서')[0];
          newReport.registerDate = new Date();
          originalReport[titleNumber-1] = newReport;

          var reports = JSON.parse(testHistoryResult.reports);
          reports[titleNumber-1].submitCount = reports[titleNumber-1].submitCount + 1;
          for(var i=0; i<reports[titleNumber-1].questions.length; i++) {
            if(reports[titleNumber-1].questions[i].category == 'objective') {
              var qid = reports[titleNumber-1].questions[i].qid;
              var report = newReport.questions[qid-1];
              reports[titleNumber-1].questions[i].options[report.answer-1].count = reports[titleNumber-1].questions[i].options[report.answer-1].count + 1;
            }
          }

          conn.write.beginTransaction(function(err) {
            if (err) {
              console.log(err);
              return next(err);
            }
            else {
              var sql = 'UPDATE testHistory SET report = ?, reportQuestion = ? WHERE uid = ? and pid = ?';
              conn.write.query(sql, [JSON.stringify(originalReport), req.body.reportQuestion, req.session.passport.user.uid, req.params.pid], function(err, results){
                if(err) {
                  rollback(next, err);
                }
                else {
                  var sql = 'UPDATE projects SET reports = ?, reportTotalCount = reportTotalCount + 1, lastReportDate = now() WHERE pid = ?';
                  conn.write.query(sql, [JSON.stringify(reports), req.params.pid], function(err, results) {
                    if(err) {
                      rollback(next, err);
                    }
                    else {
                      conn.write.commit(function(err) {
                        if(err) {
                          rollback(next, err);
                        }
                        else {
                          res.send(results);
                        }
                      });
                    }
                  });
                }
              });
            }
          });

        }
      }
    });
  });

  route.get('/tester-list/:pid', function(req, res, next) {
    var sql = 'SELECT * FROM testHistory LEFT JOIN users ON testHistory.uid = users.uid LEFT JOIN levels ON users.level = levels.level WHERE pid = ? ORDER BY testHistory.score DESC, testHistory.accuracyRate DESC, testHistory.tid';
    conn.read.query(sql, [req.params.pid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        res.send(results);
      }
    });
  });

  route.get('/dashboardNotices/:pid', function(req, res, next) {
    var sql = 'SELECT * FROM dashboardNotices WHERE pid = ? ORDER BY dashboardNotices.nid DESC';
    conn.read.query(sql, [req.params.pid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        res.send(results);
      }
    });
  });

  route.post('/dashboardNotice/:pid', function(req, res, next) {
    var sql = 'SELECT * FROM projects WHERE pid = ? and cid = ?'
    conn.read.query(sql, [req.params.pid, req.session.passport.user.cid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        conn.write.beginTransaction(function(err) {
          if (err) {
            console.log(err);
            return next(err);
          }
          else {
            if(results.length != 0) {
              var noticeData = {
                pid: req.params.pid,
                title: req.body.title,
                content: req.body.content
              }
              var sql = 'INSERT INTO dashboardNotices SET ?';
              conn.write.query(sql, noticeData, function(err, results){
                if(err) {
                  console.log(err);
                  return next(err);
                }
                else {
                  var sql = 'UPDATE projects SET noticeTotalCount = noticeTotalCount + 1, lastNoticeDate = now() WHERE pid = ?';
                  conn.write.query(sql, [req.params.pid], function(err, results) {
                    if(err) {
                      rollback(next, err);
                    }
                    else {
                      conn.write.commit(function(err) {
                        if(err) {
                          rollback(next, err);
                        }
                        else {
                          res.send(results);
                        }
                      });
                    }
                  });
                }
              });
            }
          }
        });
      }
    });
  });

  route.post('/dashboardQuestionAnswer/:pid', function(req, res, next) {
    var sql = 'UPDATE dashboardQuestions SET answer = ?, answerDate = now() WHERE pid = ? and qid = ?';
    conn.write.query(sql, [req.body.content, req.params.pid, req.body.qid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        res.send(results);
      }
    });
  });

  route.post('/dashboardQuestion/:pid', function(req, res, next) {
    conn.write.beginTransaction(function(err) {
      if (err) {
        console.log(err);
        return next(err);
      }
      else {
        var sql = 'INSERT INTO dashboardQuestions SET pid = ?, uid = ?, question = ?';
        conn.write.query(sql, [req.params.pid, req.session.passport.user.uid, req.body.content], function(err, results){
          if(err) {
            rollback(next, err);
          }
          else {
            var sql = 'UPDATE testHistory SET score = score + 5 WHERE pid = ? and uid = ?';
            conn.write.query(sql, [req.params.pid, req.session.passport.user.uid], function(err, results) {
              if(err) {
                rollback(next, err);
              }
              else {
                var sql = 'UPDATE projects SET questionTotalCount = questionTotalCount + 1, lastQuestionDate = now() WHERE pid = ?';
                conn.write.query(sql, [req.params.pid], function(err, results) {
                  if(err) {
                    rollback(next, err);
                  }
                  else {
                    conn.write.commit(function(err) {
                      if(err) {
                        rollback(next, err);
                      }
                      else {
                        res.send(results);
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  });

  route.get('/dashboardQuestions/:pid', function(req, res, next) {
    var sql = 'SELECT *, dashboardQuestions.registerDate FROM dashboardQuestions LEFT JOIN users ON dashboardQuestions.uid = users.uid LEFT JOIN levels ON users.level = levels.level LEFT JOIN testHistory ON users.uid = testHistory.uid WHERE dashboardQuestions.pid = ? and testHistory.pid = ? ORDER BY dashboardQuestions.qid DESC';
    conn.read.query(sql, [req.params.pid, req.params.pid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        res.send(results);
      }
    });
  });

  route.post('/dashboardForum/:pid', function(req, res, next) {
    conn.write.beginTransaction(function(err) {
      if (err) {
        console.log(err);
        return next(err);
      }
      else {
        var sql = 'INSERT INTO dashboardForum SET pid = ?, uid = ?, title = ?, content = ?';
        conn.write.query(sql, [req.params.pid, req.session.passport.user.uid, req.body.title, req.body.content], function(err, results){
          if(err) {
            rollback(next, err);
          }
          else {
            var sql = 'UPDATE testHistory SET score = score + 5 WHERE pid = ? and uid = ?';
            conn.write.query(sql, [req.params.pid, req.session.passport.user.uid], function(err, results) {
              if(err) {
                rollback(next, err);
              }
              else {
                var sql = 'UPDATE projects SET forumTotalCount = forumTotalCount + 1, lastForumDate = now() WHERE pid = ?';
                conn.write.query(sql, [req.params.pid], function(err, results) {
                  if(err) {
                    rollback(next, err);
                  }
                  else {
                    conn.write.commit(function(err) {
                      if(err) {
                        rollback(next, err);
                      }
                      else {
                        res.send(results);
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  });

  route.get('/dashboardForum/:pid', function(req, res, next) {
    var sql = 'SELECT *, dashboardForum.registerDate FROM dashboardForum LEFT JOIN users ON dashboardForum.uid = users.uid LEFT JOIN levels ON users.level = levels.level LEFT JOIN testHistory ON users.uid = testHistory.uid WHERE dashboardForum.pid = ? and testHistory.pid = ? ORDER BY dashboardForum.frid DESC';
    conn.read.query(sql, [req.params.pid, req.params.pid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        res.send(results);
      }
    });
  });

  route.get('/follows', function(req, res, next) {
    var sql = 'SELECT * FROM follows LEFT JOIN projects ON follows.pid = projects.pid LEFT JOIN companies ON projects.cid = companies.cid WHERE uid = ? ORDER BY follows.fid DESC';
    conn.read.query(sql, [req.session.passport.user.uid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        res.send(results);
      }
    });
  });

  route.post('/profileImage', function(req, res, next) {
    if(req.session.passport.user.uid) {
      var sql = `UPDATE users SET profileImage = ? WHERE uid = ?`;
      conn.write.query(sql, [req.body.profileImage, req.session.passport.user.uid], function(err, results){
        if(err) {
          console.log(err);
          return next(err);
        }
        else {
          req.session.passport.user.profileImage = req.body.profileImage;
          res.send(results);
        }
      });
    }
    else {
      var sql = `UPDATE companies SET profileImage = ? WHERE cid = ?`;
      conn.write.query(sql, [req.body.profileImage, req.session.passport.user.cid], function(err, results){
        if(err) {
          console.log(err);
          return next(err);
        }
        else {
          req.session.passport.user.profileImage = req.body.profileImage;
          res.send(results);
        }
      });
    }
  });

  route.post('/modify-about', function(req, res, next) {
    if(req.session.passport.user.uid) {
      var sql = 'SELECT * FROM users WHERE nickname = ? and uid != ?';
      conn.read.query(sql, [req.body.nickname, req.session.passport.user.uid], function(err, results) {
        if(results[0]) {
          res.send('이미 등록된 닉네임입니다.');
        }
        else {
          var sql = `UPDATE users SET nickname = ?, name = ?, gender = ?, age = ?, job = ?, region = ?, phoneNumber = ?, interestFields = ?, introduction = ? WHERE uid = ?`;
          conn.write.query(sql, [req.body.nickname, req.body.name, req.body.gender, req.body.age, req.body.job, req.body.region, req.body.phoneNumber, req.body.interestFields, req.body.introduction, req.session.passport.user.uid], function(err, results){
            if(err) {
              console.log(err);
              return next(err);
            }
            else {
              // session update
              req.session.passport.user.nickname = req.body.nickname;
              req.session.passport.user.name = req.body.name;
              req.session.passport.user.gender = req.body.gender;
              req.session.passport.user.age = req.body.age;
              req.session.passport.user.job = req.body.job;
              req.session.passport.user.region = req.body.region;
              req.session.passport.user.phoneNumber = req.body.phoneNumber;
              req.session.passport.user.interestFields = req.body.interestFields;
              req.session.passport.user.introduction = req.body.introduction;
              res.send('수정');
            }
          });
        }
      });
    }
    // else if(req.session.passport.user.cid) {
    //   var sql = `UPDATE companies SET introduction = ? WHERE cid = ?`;
    //   conn.write.query(sql, [req.body.introduction, req.session.passport.user.cid], function(err, results){
    //     if(err) {
    //       console.log(err);
    //       return next(err);
    //     }
    //     else {
    //       res.send(results);
    //     }
    //   });
    // }
  });

  route.post('/reward/:tid', function(req, res, next) {
    var sql = `SELECT t.score, t.ranking, t.point as tpoint, t.trophy, t.experiencePoint as texperiencePoint, t.rewardDate,
    u.*, l.* FROM testHistory t LEFT JOIN users u ON t.uid = u.uid LEFT JOIN levels l ON u.level = l.level WHERE tid = ?`;
    conn.read.query(sql, [req.params.tid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        if(!results[0].rewardDate && req.session.passport.user && results[0].tpoint && results[0].trophy && results[0].texperiencePoint) {
          if(req.session.passport.user.uid == results[0].uid) {
            var output = {
              score: results[0].score,
              ranking: results[0].ranking,
              point: results[0].tpoint,
              trophy: results[0].trophy,
              experiencePoint: results[0].texperiencePoint
            };
            // res.send(output);
            var level = results[0].level;
            var experiencePoint = results[0].experiencePoint + results[0].texperiencePoint;
            var requiredExperiencePoint = results[0].requiredExperiencePoint;
            function preFunction(callback) {
              if(isLevelUp(results[0].texperiencePoint, results[0].experiencePoint, results[0].requiredExperiencePoint)) {
                var sql = 'SELECT * FROM levels WHERE level = ? or level = ? or level = ?';
                conn.read.query(sql, [results[0].level, results[0].level+1, results[0].level+2], function(err, results){
                  if(err) {
                    console.log(err);
                    return next(err);
                  }
                  else {
                    console.log('level up');
                    if(results.length == 3) {
                      level = level + 1;
                      experiencePoint = experiencePoint - requiredExperiencePoint;
                      callback();
                    }
                    else if(results.length == 2 || results.length == 1) { // 최대 레벨일 경우
                      experiencePoint = 0; // 경험치 100%
                      callback();
                    }
                  }
                });
              }
              else {
                callback();
              }
            }

            preFunction(function() {
              conn.write.beginTransaction(function(err) {
                if (err) {
                  console.log(err);
                  return next(err);
                }
                else {
                  var sql = `UPDATE users SET
                  point = point + ${results[0].tpoint},
                  level = ${level},
                  experiencePoint = ${experiencePoint},
                  ${results[0].trophy}Count = ${results[0].trophy}Count + 1,
                  testCount = testCount + 1 WHERE uid = ${results[0].uid}
                  `;
                  conn.write.query(sql, function(err, results){
                    if(err) {
                      rollback(next, err);
                    }
                    else {
                      var sql = 'UPDATE testHistory SET rewardDate = now() WHERE tid = ?';
                      conn.write.query(sql, [req.params.tid], function(err, results) {
                        if(err) {
                          rollback(next, err);
                        }
                        else {
                          conn.write.commit(function(err) {
                            if(err) {
                              rollback(next, err);
                            }
                            else {
                              res.send(output);
                            }
                          });
                        }
                      });
                    }
                  });
                }
              });
            });
          }
        }
      }
    });
  });

  route.get('/project-list/:offset', function(req, res, next) {
    var sql = 'SELECT * FROM projects JOIN companies ON projects.cid = companies.cid WHERE projects.progressState != ? ORDER BY FIELD(progressState, "종료", "진행중", "선정중", "모집중", "대기중") DESC, pid DESC LIMIT ?, 6';
    conn.read.query(sql, ['결제대기중', Number(req.params.offset)*6], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        res.send(results);
      }
    });
  });
  route.get('/projects/:pid', function(req, res, next) {
    var sql = 'SELECT * FROM projects JOIN companies ON projects.cid = companies.cid WHERE pid = ?';
    conn.read.query(sql, [req.params.pid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        results[0].startDateArray = getStartDateArray(results[0].period);
        results[0].proceedingReport = getProceedingReport(results[0].period);
        res.send(results);
      }
    });
  });
  route.get('/projects', function(req, res, next) {
    var sql = 'SELECT * FROM projects LEFT JOIN companies ON projects.cid = companies.cid WHERE projects.cid = ?';
    conn.read.query(sql, [req.session.passport.user.cid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        res.send(results);
      }
    });
  });
  route.post('/project', function(req, res, next) {
    var baseAmount = 100000;
    var paymentPerTester = 10000 + (req.body.reportCount-2) * 4000;
    var paymentForTester = (paymentPerTester * req.body.numOfRecruitment * 70 ) / 100;
    var allocatedMoneyForGold = (paymentForTester * 20 / 100);
    var allocatedMoneyForSilver = (paymentForTester * 20 / 100);
    var allocatedMoneyForBronze = (paymentForTester * 20 / 100);
    var allocatedMoneyForNormal = (paymentForTester * 40 / 100);
    var goldCount = Math.ceil((Number(req.body.numOfRecruitment) * 5) / 100);
    var silverCount = Math.ceil((Number(req.body.numOfRecruitment) * 10) / 100);
    var bronzeCount = Math.ceil((Number(req.body.numOfRecruitment) * 20) / 100);
    var normalCount = Number(req.body.numOfRecruitment) - (goldCount + silverCount + bronzeCount);
    var reward_gold = Math.floor((allocatedMoneyForGold / goldCount)/100) * 100;
    var reward_silver = Math.floor((allocatedMoneyForSilver / silverCount)/100) * 100;
    var reward_bronze = Math.floor((allocatedMoneyForBronze / bronzeCount)/100) * 100;
    var reward_normal = Math.floor((allocatedMoneyForNormal / normalCount)/100) * 100;
    var amountOfPayment = paymentPerTester * Number(req.body.numOfRecruitment) + baseAmount;

    var projectData = {
      cid: req.session.passport.user.cid,
      projectImage: req.body.projectImage,
      projectTitle: req.body.projectTitle,
      category: req.body.category,
      numOfRecruitment: req.body.numOfRecruitment,
      reportCount: req.body.reportCount,
      period: req.body.period,
      projectVideo: req.body.projectVideo,
      coreMessage: req.body.coreMessage,
      projectStory: req.body.projectStory,
      conditions: req.body.conditions,
      reports: req.body.reports,
      testLink: req.body.testLink,
      testContent: req.body.testContent,
      reward_gold: reward_gold,
      reward_silver: reward_silver,
      reward_bronze: reward_bronze,
      reward_normal: reward_normal,
      goldCount: goldCount,
      silverCount: silverCount,
      bronzeCount: bronzeCount,
      normalCount: normalCount,
      amountOfPayment: amountOfPayment
    }

    var sql = 'INSERT INTO projects SET ?';
    conn.write.query(sql, projectData, function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        res.send(results);
      }
    });
  });

  route.post('/modifyReport/:pid', function(req, res, next) {
    var projectData = {
      reports: req.body.reports
    }

    var sql = 'UPDATE projects SET ? WHERE pid = ?';
    conn.write.query(sql, [projectData, req.params.pid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        res.send(results);
      }
    });
  });

  route.get('/comment/:cid', function(req, res, next) {
    var uid = req.session.passport.user.uid || -req.session.passport.user.cid;
    var sql = `SELECT comments.*, commentLikes.clid, commentHates.chid FROM comments
    LEFT JOIN commentLikes ON comments.cid = commentLikes.cid and commentLikes.uid = ?
    LEFT JOIN commentHates ON comments.cid = commentHates.cid and commentHates.uid = ?
    WHERE comments.cid = ?`;
    conn.read.query(sql, [uid, uid, req.params.cid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        res.send(results);
      }
    });
  });
  route.get('/comments/:pid/:offset', function(req, res, next) {
    var uid = req.session.passport.user.uid || -req.session.passport.user.cid;
    var sql = `SELECT comments.*, commentLikes.clid, commentHates.chid FROM comments
    LEFT JOIN commentLikes ON comments.cid = commentLikes.cid and commentLikes.uid = ?
    LEFT JOIN commentHates ON comments.cid = commentHates.cid and commentHates.uid = ?
    WHERE comments.pid = ? ORDER BY comments.cid DESC LIMIT ?, 4`;
    conn.read.query(sql, [uid, uid, req.params.pid,  Number(req.params.offset)*4], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        res.send(results);
      }
    });
  });
  route.post('/comments/:pid', function(req, res, next) {
    var comment = {
      pid:req.params.pid,
      uid:req.session.passport.user.uid||-req.session.passport.user.cid,
      profileImage:req.session.passport.user.profileImage,
      nickname:req.session.passport.user.nickname||req.session.passport.user.companyName,
      content:req.body.content,
    };
    conn.write.beginTransaction(function(err) {
      if (err) {
        console.log(err);
        return next(err);
      }
      else {
        var sql = 'INSERT INTO comments SET ?';
        conn.write.query(sql, comment, function(err, results){
          if(err) {
            rollback(next, err);
          }
          else {
            var sql = 'UPDATE projects SET commentCount = commentCount + 1 WHERE pid = ?';
            conn.write.query(sql, [req.params.pid], function(err, results) {
              if(err) {
                rollback(next, err);
              }
              else {
                conn.write.commit(function(err) {
                  if(err) {
                    rollback(next, err);
                  }
                  else {
                    res.send(results);
                  }
                });
              }
            });
          }
        });
      }
    });
  });
  route.get('/follows/:pid', function(req, res, next) {
    var uid = req.session.passport.user.uid || -req.session.passport.user.cid;
    var sql = 'SELECT * FROM follows WHERE pid = ? and uid = ?';
    conn.read.query(sql, [req.params.pid, uid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        if(!results[0]) { // 없을 경우
          res.send('0');
        }
        else { // 있을 경우
          res.send('1');
        }
      }
    });
  });
  route.post('/follows/:pid', function(req, res, next) {
    var uid = req.session.passport.user.uid || -req.session.passport.user.cid;
    var sql = 'SELECT * FROM follows WHERE pid = ? and uid = ?';
    conn.read.query(sql, [req.params.pid, uid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        if(!results[0]) { // 추가
          conn.write.beginTransaction(function(err) {
            if (err) {
              console.log(err);
              return next(err);
            }
            else {
              var sql = 'INSERT INTO follows SET pid = ?, uid = ?'
              conn.write.query(sql, [req.params.pid, uid], function(err, results){
                if(err) {
                  rollback(next, err);
                }
                else {
                  var sql = 'UPDATE projects SET likes = likes + 1 WHERE pid = ?';
                  conn.write.query(sql, [req.params.pid], function(err, results) {
                    if(err) {
                      rollback(next, err);
                    }
                    else {
                      conn.write.commit(function(err) {
                        if(err) {
                          rollback(next, err);
                        }
                        else {
                          res.send('1');
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        }
        else { // 이미 있을 경우
          res.send('0');
        }
      }
    });
  });
  route.post('/commentLikes/:cid', function(req, res, next) {
    var uid = req.session.passport.user.uid || -req.session.passport.user.cid;
    var sql = 'SELECT * FROM commentLikes WHERE cid = ? and uid = ?';
    conn.read.query(sql, [req.params.cid, uid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        commentLike = {
          cid:req.params.cid,
          uid:uid
        };
        if(!results[0]) { // 추가
          conn.write.beginTransaction(function(err) {
            if (err) {
              console.log(err);
              return next(err);
            }
            else {
              var sql = 'INSERT INTO commentLikes SET ?';
              conn.write.query(sql, commentLike, function(err, results){
                if(err) {
                  rollback(next, err);
                }
                else {
                  var sql = 'UPDATE comments SET likeCount = likeCount + 1 WHERE cid = ?';
                  conn.write.query(sql, [req.params.cid], function(err, results) {
                    if(err) {
                      rollback(next, err);
                    }
                    else {
                      conn.write.commit(function(err) {
                        if(err) {
                          rollback(next, err);
                        }
                        else {
                          res.send(results);
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        }
        else { // 삭제
          conn.write.beginTransaction(function(err) {
            if (err) {
              console.log(err);
              return next(err);
            }
            else {
              var sql = 'DELETE FROM commentLikes WHERE cid = ? and uid = ?';
              conn.write.query(sql, [req.params.cid, uid], function(err, results){
                if(err) {
                  rollback(next, err);
                }
                else {
                  var sql = 'UPDATE comments SET likeCount = likeCount - 1 WHERE cid = ?';
                  conn.write.query(sql, [req.params.cid], function(err, results) {
                    if(err) {
                      rollback(next, err);
                    }
                    else {
                      conn.write.commit(function(err) {
                        if(err) {
                          rollback(next, err);
                        }
                        else {
                          res.send(results);
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        }
      }
    });
  });
  route.post('/commentHates/:cid', function(req, res, next) {
    var uid = req.session.passport.user.uid || -req.session.passport.user.cid;
    var sql = 'SELECT * FROM commentHates WHERE cid = ? and uid = ?';
    conn.read.query(sql, [req.params.cid, uid], function(err, results){
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        commentLike = {
          cid:req.params.cid,
          uid:uid
        };
        if(!results[0]) { // 추가
          conn.write.beginTransaction(function(err) {
            if (err) {
              console.log(err);
              return next(err);
            }
            else {
              var sql = 'INSERT INTO commentHates SET ?';
              conn.write.query(sql, commentLike, function(err, results){
                if(err) {
                  rollback(next, err);
                }
                else {
                  var sql = 'UPDATE comments SET hateCount = hateCount + 1 WHERE cid = ?';
                  conn.write.query(sql, [req.params.cid], function(err, results) {
                    if(err) {
                      rollback(next, err);
                    }
                    else {
                      conn.write.commit(function(err) {
                        if(err) {
                          rollback(next, err);
                        }
                        else {
                          res.send(results);
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        }
        else { // 삭제
          conn.write.beginTransaction(function(err) {
            if (err) {
              console.log(err);
              return next(err);
            }
            else {
              var sql = 'DELETE FROM commentHates WHERE cid = ? and uid = ?';
              conn.write.query(sql, [req.params.cid, uid], function(err, results){
                if(err) {
                  rollback(next, err);
                }
                else {
                  var sql = 'UPDATE comments SET hateCount = hateCount - 1 WHERE cid = ?';
                  conn.write.query(sql, [req.params.cid], function(err, results) {
                    if(err) {
                      rollback(next, err);
                    }
                    else {
                      conn.write.commit(function(err) {
                        if(err) {
                          rollback(next, err);
                        }
                        else {
                          res.send(results);
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        }
      }
    });
  });

  // 삭제
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

  function addDays(date, days) {
      var result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
  }

  function rollback(next, err) {
    conn.write.rollback(function() {
      console.log(err);
      return next(err);
    });
  }

  function isLevelUp(rewardExp, exp, requiredExp) {
    if(exp + rewardExp >= requiredExp) {
      return true;
    }
    else {
      return false;
    }
  }

  function getAccuracyRate(age, gender, interestFields, job, region, conditions) {
    var conditions = JSON.parse(conditions);
    var accuracyRate = 0;
    if(age != null) {
      if(age < 40) {
        var ages = Math.floor(age / 10) * 10 + '대';
      }
      else {
        var ages = '40대~';
      }
      if(conditions.age.includes('무관') || conditions.age.includes(ages)) {
        accuracyRate += 20;
      }
    }
    if(conditions.gender == '무관' || (gender != null && conditions.gender == gender)) {
      accuracyRate += 20;
    }
    if(conditions.interestFields == '무관' || (interestFields != null && interestFields.includes(conditions.interestFields))) {
      accuracyRate += 20;
    }
    if(conditions.job == '무관' || (job != null && conditions.job == job)) {
      accuracyRate += 20;
    }
    if(conditions.region == '무관' || (region != null && conditions.region == region)) {
      accuracyRate += 20;
    }
    return accuracyRate;
  }

  return route;
}
