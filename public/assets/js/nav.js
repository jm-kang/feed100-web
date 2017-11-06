$(document).ready(function() {
  var page = document.location.href.split('//')[1].split('/')[1];
  $.ajax({
    url:'/sess',
    type:'get',
    cache:false,
    success:function(data){
      if(data.passport && data.passport.user) {
        $("nav").html(
          '<div class="container" style="width: 94%;">' +
              '<div class="navbar-header">' +
                  '<button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#navbar" aria-expanded="false" aria-controls="navbar">' +
                      '<span class="sr-only">Toggle navigation</span>' +
                      '<span class="icon-bar"></span>' +
                      '<span class="icon-bar"></span>' +
                      '<span class="icon-bar"></span>' +
                  '</button>' +
                  '<a class="navbar-brand" href="/">' +
                      '<img src="/assets/images/logo-light.png" alt="" class="logo-default">' +
                      '<img src="/assets/images/logo.png" alt="" class="logo-scroll">' +
                  '</a>' +
              '</div>' +
              '<div id="navbar" class="navbar-collapse collapse">' +
                  '<ul class="nav navbar-nav navbar-right scroll-to">' +
                      '<li class="' + ((page == 'explore' || page == 'project') ? 'active' : '') + '"><a href="/explore">프로젝트 둘러보기</a></li>' +
                      '<li class="' + ((page == 'start-project') ? 'active' : '') + '"><a href="/start-project">프로젝트 등록</a></li>' +
                      '<li class="' + ((page == 'manual') ? 'active' : '') + '"><a href="/manual">매뉴얼</a></li>' +
                      '<li class="' + ((page == 'faq') ? 'active' : '') + '"><a href="/faq">FAQ</a></li>' +
                      '<li class="dropdown ' + ((page == 'account') ? 'active' : '') + '">' +
                          '<span class="dropdown-toggle menu-drop-toggle" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false">' +
                            '<div class="profile">' +
                              '<div class="image-upload">' +
                                  '<label for="ex_filename">' +
                                    '<div id="circle-nav">' +
                                      '<img src="' + data.passport.user.profileImage + '" style="width:100%;" alt="image"/>' +
                                    '</div>' +
                                  '</label>' +
                              '</div>' +
                            '</div>' +
                          '</span>' +
                          '<ul class="dropdown-menu">' +
                              '<li>' +
                                '<div class="dropdown-profile">' +
                                  '<h5>' + ((data.passport.user.uid) ? '<small style="color:#fff">Lv.' + data.passport.user.level + '</small>&ensp;' : '') + ((data.passport.user.uid) ? data.passport.user.nickname : data.passport.user.companyName) +'</h5>' +
                                  '<h6>'+ data.passport.user.email +'</h6>' +
                                  ((data.passport.user.uid) ? '<h6 style="margin-top: 10px;">포인트 : '+ numberWithCommas(data.passport.user.point) +'원</h6>' : '') +
                                '</div>' +
                              '</li>' +

                              '<li style="margin-top:17px;">' +
                                '<h5>진행중인 프로젝트 바로가기&ensp;<small style="font-weight:bold; color:#CA8500;">new</small></h5>' +
                              '</li>' +
                              '<li><h6 style="text-align:center"><i class="fa fa-exclamation" style="color:red"></i>&nbsp;진행중인 프로젝트가 없습니다.</h6></li>' +
                              '<li class="border-li"></li>' +

                              '<li><a href="/account">마이페이지</a></li>' +
                              '<li style="margin-bottom:25px;"><a id="logout" style="cursor: pointer;">로그아웃</a></li>' +
                          '</ul>' +
                      '</li>' +
                  '</ul>' +
              '</div>' +
          '</div>'
          );

          if(data.passport.user.uid) {
            $.ajax({
              url:'/api/test-history',
              type:'get',
              success:function(data) {
                var output = '';
                for(var i=0; i<data.length; i++) {
                  if(data[i].progressState == '진행중') {
                    output += '<li><a target="_blank" class="dropdown-projectTitle" href="/project/' + data[i].pid +'">' + data[i].projectTitle + '</a></li>';
                  }
                }
                if(output) {
                  $('nav').find('ul.dropdown-menu li.border-li').prev().remove();
                  $('nav').find('ul.dropdown-menu li.border-li').before(output);
                }
              },
              error:function(data) {
                alert('오류가 발생했습니다.');
              }
            });
          }
          else if(data.passport.user.cid) {
            $.ajax({
              url:'/api/projects',
              type:'get',
              success:function(data) {
                var output = '';
                for(var i=0; i<data.length; i++) {
                  if(data[i].progressState != '종료' && data[i].progressState != '결제대기중') {
                    output += '<li><a target="_blank" class="dropdown-projectTitle" href="/dashboard_company/dashboard/' + data[i].pid +'">' + data[i].projectTitle + ' <small>(' + data[i].progressState + ')</small></a></li>';
                  }
                }
                if(output) {
                  $('nav').find('ul.dropdown-menu li.border-li').prev().remove();
                  $('nav').find('ul.dropdown-menu li.border-li').before(output);
                }
              },
              error:function(data) {
                alert('오류가 발생했습니다.');
              }
            });
          }

      }
      else {
        $("nav").html(
          '<div class="container" style="width: 94%;">'+
              '<div class="navbar-header">'+
                  '<button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#navbar" aria-expanded="false" aria-controls="navbar">'+
                      '<span class="sr-only">Toggle navigation</span>'+
                      '<span class="icon-bar"></span>'+
                      '<span class="icon-bar"></span>'+
                      '<span class="icon-bar"></span>'+
                  '</button>'+
                  '<a class="navbar-brand" href="/">'+
                      '<img src="assets/images/logo-light.png" alt="" class="logo-default">'+
                      '<img src="assets/images/logo.png" alt="" class="logo-scroll">'+
                  '</a>'+
              '</div>'+
              '<div id="navbar" class="navbar-collapse collapse">'+
                  '<ul class="nav navbar-nav navbar-right scroll-to">'+
                      '<li class="' + ((page == 'explore' || page == 'project') ? 'active' : '') + '"><a href="/explore">프로젝트 둘러보기</a></li>' +
                      '<li class="' + ((page == 'start-project') ? 'active' : '') + '"><a href="/start-project">프로젝트 등록</a></li>' +
                      '<li class="' + ((page == 'manual') ? 'active' : '') + '"><a href="/manual">매뉴얼</a></li>' +
                      '<li class="' + ((page == 'faq') ? 'active' : '') + '"><a href="/faq">FAQ</a></li>' +
                      '<li><a href="/login">로그인</a></li>'+
                      '<li><a href="/join">회원가입</a></li>'+
                  '</ul>'+
              '</div>'+
          '</div>'
          );
      }
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
    },
    error:function(data){
      alert('오류가 발생했습니다.');
    }
  });


  function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

});
