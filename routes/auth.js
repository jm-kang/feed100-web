module.exports = function(passport, conn) {
  var pbkfd2Password = require("pbkdf2-password");
  var hasher = pbkfd2Password();
  var route = require('express').Router();

  route.post('/login', function(req, res, next) {
    passport.authenticate('local', function(err, user, info) {
      if (err) { return next(err); }
      if (!user || !user.hasOwnProperty(req.body.user_id)) {
        res.send('이메일 또는 비밀번호를 확인해주세요.');
      }
      else {
        req.login(user, function(err) {
          req.session.save(function(){
            res.send('로그인');
          });
        });
      }
    })(req, res, next);
  });
  route.get('/facebook', passport.authenticate('facebook',
      {
        scope:['user_birthday', 'email']
      }
    )
  );
  route.get('/facebook/callback', function(req, res, next) {
    passport.authenticate('facebook', function(err, user, info) {
      var sql = 'SELECT * FROM users WHERE authId=?';
      conn.read.query(sql, ['facebook:' + user.id], function(err, results){
        if(err) {
          console.log(err);
          return next(err);
        }
        if(results[0]) {
          req.login(results[0], function(err) {
            req.session.save(function(){
              replace(res);
            });
          });
        }
        else {
          req.session.SNS_info = user;
          console.log('user : ', req.session);
          res.redirect('/join-sns');
        }
      });
    })(req, res, next);
  });
  route.get('/google', passport.authenticate('google',
      {
        scope: [
          'profile',
          'email'
        ]
      }
    )
  );
  route.get('/google/callback', function(req, res, next) {
    passport.authenticate('google', function(err, user, info) {
      var sql = 'SELECT * FROM users WHERE authId=?';
      conn.read.query(sql, ['google:' + user.id], function(err, results){
        if(err) {
          console.log(err);
          return next(err);
        }
        if(results[0]) {
          req.login(results[0], function(err) {
            req.session.save(function(){
              replace(res);
            });
          });
        }
        else {
          req.session.SNS_info = user;
          console.log('user : ', req.session);
          res.redirect('/join-sns');
        }
      });
    })(req, res, next);
  });

  route.post('/join-email', function(req, res, next){
    var sql = 'SELECT uid, email FROM users WHERE email = ? UNION SELECT cid, email FROM companies WHERE email = ?';
    conn.read.query(sql, [req.body.username, req.body.username], function(err, results) {
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        if(results[0]) {
          res.send('이미 등록된 이메일 주소입니다.');
        }
        else {
          var sql = 'SELECT * FROM users WHERE nickname = ?';
          conn.read.query(sql, req.body.nickname, function(err, results) {
            if(err) {
              console.log(err);
              return next(err);
            }
            else {
              if(results[0]) {
                res.send('이미 등록된 닉네임입니다.');
              }
              else {
                hasher({password:req.body.password}, function(err, pass, salt, hash){
                  var user = {
                    authId:'local:'+req.body.username,
                    email:req.body.username,
                    password:hash,
                    salt:salt,
                    nickname:req.body.nickname
                  };
                  var sql = 'INSERT INTO users SET ?';
                  conn.write.query(sql, user, function(err, results){
                    if(err){
                      console.log(err);
                      return next(err);
                    }
                    else {
                      var sql = 'SELECT * FROM users WHERE authId = ?';
                      conn.read.query(sql, user.authId, function(err, results){
                        if(err) {
                          console.log(err);
                          return next(err);
                        }
                        else {
                          req.login(results[0], function(err){
                            req.session.save(function(){
                              res.send('로그인');
                            });
                          });
                        }
                      });
                    }
                  });
                });
              }
            }
          });
        }
      }
    });
  });
  route.post('/join-com', function(req, res, next){
    var sql = 'SELECT uid, email FROM users WHERE email = ? UNION SELECT cid, email FROM companies WHERE email = ?';
    conn.read.query(sql, [req.body.username, req.body.username], function(err, results) {
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        if(results[0]) {
          res.send('이미 등록된 이메일 주소입니다.');
        }
        else {
          hasher({password:req.body.password}, function(err, pass, salt, hash){
            var company = {
              authId:'local:'+req.body.username,
              email:req.body.username,
              password:hash,
              salt:salt,
              companyName:req.body.companyName,
              phoneNumber:req.body.phoneNumber
            };
            var sql = 'INSERT INTO companies SET ?';
            conn.write.query(sql, company, function(err, results){
              if(err){
                console.log(err);
                return next(err);
              }
              else {
                var sql = 'SELECT * FROM companies WHERE authId = ?';
                conn.read.query(sql, company.authId, function(err, results){
                  if(err) {
                    console.log(err);
                    return next(err);
                  }
                  else {
                    req.login(results[0], function(err){
                      req.session.save(function(){
                        res.send('로그인');
                      });
                    });
                  }
                });
              }
            });
          });
        }
      }
    });
  });
  route.post('/join-sns', function(req, res, next){
    var sql = 'SELECT uid, email FROM users WHERE email = ? UNION SELECT cid, email FROM companies WHERE email = ?';
    conn.read.query(sql, [req.body.username, req.body.username], function(err, results) {
      if(err) {
        console.log(err);
        return next(err);
      }
      else {
        if(results[0]) {
          res.send('이미 등록된 이메일 주소입니다.');
        }
        else {
          var sql = 'SELECT * FROM users WHERE nickname = ?';
          conn.read.query(sql, req.body.nickname, function(err, results) {
            if(err) {
              console.log(err);
              return next(err);
            }
            else {
              if(results[0]) {
                res.send('이미 등록된 닉네임입니다.');
              }
              else {
                var user = {
                  authId:req.body.provider+':'+req.body.id,
                  email:req.body.username,
                  nickname:req.body.nickname,
                };
                var sql = 'INSERT INTO users SET ?';
                conn.write.query(sql, user, function(err, results){
                  if(err){
                    console.log(err);
                    return next(err);
                  }
                  else {
                    var sql = 'SELECT * FROM users WHERE authId = ?';
                    conn.read.query(sql, user.authId, function(err, results){
                      if(err) {
                        console.log(err);
                        return next(err);
                      }
                      else {
                        req.login(results[0], function(err){
                          req.session.save(function(){
                            res.send('로그인');
                          });
                        });
                      }
                    });
                  }
                });
              }
            }
          });
        }
      }
    });

  });
  route.post('/logout', function(req, res){
    req.logout();
    req.session.save(function(){
      res.send('로그아웃');
    });
  });

  function replace(res) {
    res.send(`
      <script>
      window.location.replace("/login");
      </script>
      `);
  }

  return route;
}
