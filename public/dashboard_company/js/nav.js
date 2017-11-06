$(document).ready(function() {
  var params = document.location.href.split("/");
  var pid = params[params.length-1].split('#')[0];

  $('#wrapper').prepend(
    '<nav class="navbar-default navbar-static-side" role="navigation">' +
        '<div class="sidebar-collapse">' +
            '<ul class="nav metismenu" id="side-menu">' +
                '<li class="nav-header">' +
                    '<div class="dropdown profile-element">' +
                        '<div style="margin: auto; width: 54px; height: 54px; border-radius: 120px; padding-top: 2px; background-color: #e1e1e1; margin-bottom: 0; line-height: 48px;">' +
                            '<div style="position: relative; margin: 0 auto; width: 50px; height: 50px; box-shadow: 0 0 0 0; border-radius: 50%; overflow: hidden;">' +
                                '<img alt="image" id="profileImage" src="" style="width:100%;"/>' +
                            '</div>' +
                        '</div>' +
                        '<a data-toggle="dropdown" class="dropdown-toggle" >' +
                            '<span class="clear"> <span class="block m-t-xs"> <strong class="font-bold" id="nickname"></strong>' +
                        '</a>' +
                    '</div>' +
                    '<div class="logo-element">' +
                        'F1' +
                    '</div>' +
                '</li>' +
                '<li>' +
                    '<a href="/dashboard_company/dashboard/' + pid + '"><i class="fa fa-th-large"></i> <span class="nav-label">홈</span></a>' +
                '</li>' +
                '<li>' +
                    '<a href="/dashboard_company/reports/' + pid + '"><i class="fa fa-file-text"></i> <span class="nav-label">보고서</span></a>' +
                '</li>' +
                '<li>' +
                    '<a href="/dashboard_company/testers/' + pid + '"><i class="fa fa-users"></i> <span class="nav-label">테스터</span></a>' +
                '</li>' +
                '<li>' +
                    '<a href="/dashboard_company/calendar/' + pid + '"><i class="fa fa-calendar"></i> <span class="nav-label">캘린더</span></a>' +
                '</li>' +
                '<li>' +
                    '<a href="/dashboard_company/notices/' + pid + '"><i class="fa fa-th-list"></i> <span class="nav-label">공지사항</span></a>' +
                '</li>' +
                '<li>' +
                    '<a href="/dashboard_company/forum/' + pid + '"><i class="fa fa-th-list"></i> <span class="nav-label">기능 개선 토론장</span></a>' +
                '</li>' +
                '<li>' +
                    '<a href="/dashboard_company/questions/' + pid + '"><i class="fa fa-question-circle"></i> <span class="nav-label">질문 게시판</span></a>' +
                '</li>' +
            '</ul>' +

        '</div>' +
    '</nav>'
    );
    $('#page-wrapper').prepend(
      '<div class="row border-bottom">' +
          '<nav class="navbar navbar-static-top white-bg" role="navigation" style="margin-bottom: 0">' +
              '<div class="navbar-header">' +
                  '<a class="navbar-minimalize minimalize-styl-2 btn btn-primary " href="#"><i class="fa fa-bars"></i> </a>' +
                  '<span id="projectTitle"></span>' +
              '</div>' +
              '<ul class="nav navbar-top-links navbar-right">' +
                  '<li>' +
                      '<strong class="proceeding_color"></strong>' +
                  '</li>' +

                  '<li class="dropdown alarm">' +
                      '<a class="dropdown-toggle count-info" data-toggle="dropdown" href="#">' +
                          '<i class="fa fa-bell"></i> <span class="label label-primary">0</span>' +
                      '</a>' +
                      '<ul class="dropdown-menu dropdown-alerts">' +
                      '</ul>' +
                  '</li>' +


                  '<li>' +
                      '<a id="logout" style="cursor: pointer;">' +
                          'Log out' +
                      '</a>' +
                  '</li>' +
                  '<li class="dropdown">' +
                      '<a class="dropdown-toggle count-info" data-toggle="dropdown" href="#">' +
                          '<i class="fa fa-globe"></i>' +
                      '</a>' +
                      '<ul class="dropdown-menu dropdown-globe">' +
                          '<li>' +
                              '<a href="/">' +
                                  '<div>' +
                                      '<i class="fa fa-home"></i> FEED100 홈페이지로 이동' +
                                  '</div>' +
                              '</a>' +
                              '<a href="/project/' + pid + '">' +
                                  '<div>' +
                                      '<i class="fa fa-file-text"></i> 프로젝트 페이지로 이동' +
                                  '</div>' +
                              '</a>' +
                          '</li>' +
                      '</ul>' +
                  '</li>' +
              '</ul>' +

          '</nav>' +
      '</div>'
      );

      $('#logout').click(function() {
        $.ajax({
          url:'/auth/logout',
          type:'post',
          cache:false,
          success:function(data) {
            if(data == '로그아웃') {
              window.location.replace('/');
            }
            else {
              alert(data);
            }
          },
          error:function(data) {
            alert('오류가 발생했습니다.');
          }
        })
      });

      $.ajax({
        url:'/api/projects/'+pid,
        type:'get',
        cache:false,
        success:function(data){
          $('#profileImage').attr('src', data[0].profileImage);
          (data[0].nickname == undefined) ? $('#nickname').html(data[0].companyName) : $('#nickname').html(data[0].nickname);
          $('#projectTitle').html(data[0].projectTitle);

          var reportAlarmCount = data[0].reportTotalCount - data[0].lastCheckedReportCount;
          var forumAlarmCount = data[0].forumTotalCount - data[0].lastCheckedForumCount;
          var questionAlarmCount = data[0].questionTotalCount - data[0].lastCheckedQuestionCount;
          var totalAlarmCount = reportAlarmCount + forumAlarmCount + questionAlarmCount;

          if(data[0].progressState == '모집중') {
            var period = JSON.parse(data[0].period);
            if(data[0].numOfApplicant != 0) {
              $('#side-menu li').eq(3).find('a').append('<span class="label label-warning pull-right">NEW</span>');
              $('li.alarm ul.dropdown-alerts').append(
                '<li>' +
                    '<a href="/dashboard_company/testers/' + pid + '">' +
                        '<div>' +
                            '<i class="fa fa-users"></i> 새로운 테스터를 확인해주세요!' +
                            '<time class="pull-right text-muted small timeago" datetime="' + period[2].startDate + '"></time>' +
                        '</div>' +
                    '</a>' +
                '</li>'
              );
              totalAlarmCount += 1;
            }
          }
          if(data[0].progressState == '선정중') {
            var period = JSON.parse(data[0].period);
            if(data[0].numOfApplicant != 0) {
              $('#side-menu li').eq(3).find('a').append('<span class="label label-warning pull-right">NEW</span>');
              $('li.alarm ul.dropdown-alerts').append(
                '<li>' +
                    '<a href="/dashboard_company/testers/' + pid + '">' +
                        '<div>' +
                            '<i class="fa fa-users"></i> 조건에 맞는 테스터를 선정해주세요!' +
                            '<time class="pull-right text-muted small timeago" datetime="' + period[3].startDate + '"></time>' +
                        '</div>' +
                    '</a>' +
                '</li>'
              );
              totalAlarmCount += 1;
            }
          }

          $('li.alarm a.count-info span').html(totalAlarmCount);
          if(totalAlarmCount == 0) {
            $('li.alarm ul.dropdown-alerts').html('<li>등록된 알림이 없습니다.</li>');
          }
          else {
            var output = '';
            if(reportAlarmCount != 0) {
              if($('li.alarm ul.dropdown-alerts').html() != '') {
                output += '<li class="divider"></li>';
              }
              output +=
              '<li>' +
                  '<a href="/dashboard_company/reports/' + pid + '">' +
                      '<div>' +
                          '<i class="fa fa-file-text"></i> ' + reportAlarmCount + '개의 새로운 보고서가 등록되었습니다.' +
                          '<time class="pull-right text-muted small timeago" datetime="' + data[0].lastReportDate + '"></time>' +
                      '</div>' +
                  '</a>' +
              '</li>'
              ;
              $('#side-menu li').eq(2).find('a').append('<span class="label label-info pull-right">' + reportAlarmCount + '</span>');
            }
            if(forumAlarmCount != 0) {
              if($('li.alarm ul.dropdown-alerts').html() != '') {
                output += '<li class="divider"></li>';
              }
              output +=
              '<li>' +
                  '<a href="/dashboard_company/forum/' + pid + '">' +
                      '<div>' +
                          '<i class="fa fa-th-list"></i> ' + forumAlarmCount + '개의 새로운 토론이 등록되었습니다.' +
                          '<time class="pull-right text-muted small timeago" datetime="' + data[0].lastForumDate + '"></time>' +
                      '</div>' +
                  '</a>' +
              '</li>'
              ;
              $('#side-menu li').eq(6).find('a').append('<span class="label label-info pull-right">' + forumAlarmCount + '</span>');
            }
            if(questionAlarmCount != 0) {
              if($('li.alarm ul.dropdown-alerts').html() != '') {
                output += '<li class="divider"></li>';
              }
              output +=
              '<li>' +
                  '<a href="/dashboard_company/questions/' + pid + '">' +
                      '<div>' +
                          '<i class="fa fa-question-circle"></i> ' + questionAlarmCount + '개의 새로운 질문이 등록되었습니다.' +
                          '<time class="pull-right text-muted small timeago" datetime="' + data[0].lastQuestionDate + '"></time>' +
                      '</div>' +
                  '</a>' +
              '</li>'
              ;
              $('#side-menu li').eq(7).find('a').append('<span class="label label-info pull-right">' + questionAlarmCount + '</span>');
            }
            $('li.alarm ul.dropdown-alerts').append(output);
            $('time.timeago').timeago();
          }
        },
        error:function(data){
          alert('오류가 발생했습니다.');
        }
      });

      var page = params[params.length-2];
      if(page == 'register-notice') {
        page = 'notices';
      }
      $('#side-menu a[href="/dashboard_company/'+page+'/'+pid+'"]').parent().addClass('active');

});
