var app = require('./config/express')();
var conn = require('./config/db')(app);
var passport = require('./config/passport')(app, conn);

var auth = require('./routes/auth')(passport, conn);
var api = require('./routes/api')(conn);
var cron = require('./cron')(app, conn);

app.use('/auth/', auth);
app.use('/api/', api);
app.use('/cron/', cron);

app.get('/sess', function(req, res, next) {
  console.log('previewInfo', req.session.previewInfo);
  res.send(req.session);
});

app.post('/sess', function(req, res, next) {
  var projectData = {
    companyName: req.session.passport.user.companyName,
    projectImage: req.body.projectImage,
    projectTitle: req.body.projectTitle,
    category: req.body.category,
    numOfRecruitment: req.body.numOfRecruitment,
    reportCount: req.body.reportCount,
    period: req.body.period,
    projectVideo: req.body.projectVideo,
    coreMessage: req.body.coreMessage,
    projectStory: req.body.projectStory,
    reports: req.body.reports
  }
  req.session.previewInfo = projectData;
  res.send(req.session);
});

app.get('/admin/feed100by410', function(req, res, next) {
  res.sendFile(__dirname + '/public/admin.html');
});

app.get('/project/:pid', function(req, res, next) {
  if(typeof req.session.passport !== 'undefined' && typeof req.session.passport.user !== 'undefined') {
    if(req.session.passport.user.uid) {
      var sql = 'SELECT * FROM testHistory LEFT JOIN projects ON testHistory.pid = projects.pid WHERE testHistory.pid = ? and testHistory.uid = ? and projects.progressState = "진행중"';
      conn.read.query(sql, [req.params.pid, req.session.passport.user.uid], function(err, results){
        if(err) {
          console.log(err);
          return next(err);
        }
        else {
          if(!results[0]) {
            var sql = 'UPDATE projects SET views = views + 1 WHERE pid = ?';
            conn.write.query(sql, [req.params.pid], function(err, results){
              if(err) {
                console.log(err);
                return next(err);
              }
              else {
                res.sendFile(__dirname + '/public/project.html');
              }
            });
          }
          else {
            res.redirect('/dashboard_tester/dashboard/'+req.params.pid);
          }
        }
      });
    }
    else if(req.session.passport.user.cid) {
      res.sendFile(__dirname + '/public/project.html');
    }
  }
  else {
    accessControl(res, `alert('로그인 후 이용해주세요.');`);
  }
});

app.get('/:fileName', function(req, res, next) {
  switch(req.params.fileName) {
    case 'join':
    case 'join-email':
    case 'join-sns':
    case 'join-com':
      if(typeof req.session.passport !== 'undefined' && typeof req.session.passport.user !== 'undefined') {
        accessControl(res, '');
      }
      else {
        res.sendFile(__dirname + '/public/' + req.params.fileName + '.html');
      }
      break;
    case 'account':
      if(typeof req.session.passport !== 'undefined' && typeof req.session.passport.user !== 'undefined') {
        if(req.session.passport.user.uid) {
          res.sendFile(__dirname + '/public/myPage.html');
        }
        else {
          res.sendFile(__dirname + '/public/companyPage.html');
        }
      }
      else {
        accessControl(res, '');
      }
      break;
    case 'login':
      if(typeof req.session.passport !== 'undefined' && typeof req.session.passport.user !== 'undefined') {
        accessControl(res, '');
      }
      else {
        res.sendFile(__dirname + '/public/login.html');
      }
      break;
    case 'start-project':
      res.sendFile(__dirname + '/public/start_project.html');
      break;
    case 'register-project':
      if(typeof req.session.passport !== 'undefined' && typeof req.session.passport.user !== 'undefined' && typeof req.session.passport.user.cid !== 'undefined') {
        res.sendFile(__dirname + '/public/register_project.html');
      }
      else {
        accessControl(res, `alert('기업회원만 이용할 수 있습니다.');`);
      }
      break;
    case 'manual':
    case 'explore':
    case 'faq':
    case 'index':
    case 'project-preview':
    case 'simple-register':
      res.sendFile(__dirname + '/public/' + req.params.fileName + '.html');
      break;
    default:
      res.redirect('/');
  }
});

app.get('/dashboard_company/:fileName/:pid', function(req, res, next) {
  if(typeof req.session.passport !== 'undefined' && typeof req.session.passport.user !== 'undefined') {
    if(req.session.passport.user.cid) {
      var sql = 'SELECT * FROM projects WHERE pid = ? and cid = ?';
      conn.read.query(sql, [req.params.pid, req.session.passport.user.cid], function(err, results){
        if(err) {
          console.log(err);
          return next(err);
        }
        else {
          if(!results[0]) {
            accessControl(res, `alert('권한이 없습니다.');`);
          }
          else {
            switch(req.params.fileName) {
              case 'dashboard':
                res.sendFile(__dirname + '/public/dashboard_company/index.html');
                break;
              case 'reports':
                var sql = 'UPDATE projects SET lastCheckedReportCount = reportTotalCount WHERE pid = ?';
                conn.write.query(sql, req.params.pid, function(err, results) {
                  res.sendFile(__dirname + '/public/dashboard_company/reports.html');
                });
                break;
              case 'reports2':
                var sql = 'UPDATE projects SET lastCheckedReportCount = reportTotalCount WHERE pid = ?';
                conn.write.query(sql, req.params.pid, function(err, results) {
                  res.sendFile(__dirname + '/public/dashboard_company/reports2.html');
                });
                break;
              case 'testers':
                res.sendFile(__dirname + '/public/dashboard_company/testers.html');
                break;
              case 'forum':
                var sql = 'UPDATE projects SET lastCheckedForumCount = forumTotalCount WHERE pid = ?';
                conn.write.query(sql, req.params.pid, function(err, results) {
                  res.sendFile(__dirname + '/public/dashboard_company/forum.html');
                });
                break;
              case 'calendar':
                res.sendFile(__dirname + '/public/dashboard_company/calendar.html');
                break;
              case 'notices':
                res.sendFile(__dirname + '/public/dashboard_company/notices.html');
                break;
              case 'register-notice':
                res.sendFile(__dirname + '/public/dashboard_company/notices_regist.html');
                break;
              case 'questions':
                var sql = 'UPDATE projects SET lastCheckedQuestionCount = questionTotalCount WHERE pid = ?';
                conn.write.query(sql, req.params.pid, function(err, results) {
                  res.sendFile(__dirname + '/public/dashboard_company/questions.html');
                });
                break;
            }
          }
        }
      });
    }
  }
});

app.get('/dashboard_tester/:fileName/:pid', function(req, res, next) {
  if(typeof req.session.passport !== 'undefined' && typeof req.session.passport.user !== 'undefined') {
    if(req.session.passport.user.uid) {
      var sql = 'SELECT * FROM testHistory LEFT JOIN projects ON testHistory.pid = projects.pid WHERE testHistory.pid = ? and testHistory.uid = ? and projects.progressState = "진행중"';
      conn.read.query(sql, [req.params.pid, req.session.passport.user.uid], function(err, results){
        if(err) {
          console.log(err);
          return next(err);
        }
        else {
          if(!results[0]) {
            accessControl(res, `alert('권한이 없습니다.');`);
          }
          else {
            switch(req.params.fileName) {
              case 'dashboard':
                res.sendFile(__dirname + '/public/dashboard_tester/index.html');
                break;
              case 'reports':
                res.sendFile(__dirname + '/public/dashboard_tester/reports.html');
                break;
              case 'ranking':
                res.sendFile(__dirname + '/public/dashboard_tester/ranking.html');
                break;
              case 'calendar':
                res.sendFile(__dirname + '/public/dashboard_tester/calendar.html');
                break;
              case 'story':
                res.sendFile(__dirname + '/public/dashboard_tester/story.html');
                break;
              case 'notices':
                var sql = 'UPDATE testHistory LEFT JOIN projects ON testHistory.pid = projects.pid SET testHistory.lastCheckedNoticeCount = projects.noticeTotalCount WHERE testHistory.pid = ? and uid = ?';
                conn.write.query(sql, [req.params.pid, req.session.passport.user.uid], function(err, results) {
                  res.sendFile(__dirname + '/public/dashboard_tester/notices.html');
                });
                break;
              case 'forum':
                var sql = 'UPDATE testHistory LEFT JOIN projects ON testHistory.pid = projects.pid SET testHistory.lastCheckedForumCount = projects.forumTotalCount WHERE testHistory.pid = ? and uid = ?';
                conn.write.query(sql, [req.params.pid, req.session.passport.user.uid], function(err, results) {
                  res.sendFile(__dirname + '/public/dashboard_tester/forum.html');
                });
                break;
              case 'questions':
                var sql = 'UPDATE testHistory LEFT JOIN projects ON testHistory.pid = projects.pid SET testHistory.lastCheckedQuestionCount = projects.questionTotalCount WHERE testHistory.pid = ? and uid = ?';
                conn.write.query(sql, [req.params.pid, req.session.passport.user.uid], function(err, results) {
                  res.sendFile(__dirname + '/public/dashboard_tester/questions.html');
                });
                break;
            }
          }
        }
      });
    }
  }
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

function accessControl(res, alert) {
  res.send(`
    <script>
    ${alert}
    window.location.replace("/");
    </script>`);
}

module.exports = app;
