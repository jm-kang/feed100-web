var $ = $.noConflict();
$(document).ready(function () {
    "use strict";
//sticky header
    $(window).resize(function () {
        $(".navbar-collapse").css({maxHeight: $(window).height() - $(".navbar-header").height() + "px"});
    });

//sticky header on scroll
        $(".sticky-header").sticky({topSpacing: 0});


// site preloader
    $(window).load(function () {
        $('#preloader').fadeOut('slow', function () {
            $(this).remove();
        });
    });

    //animated scroll menu
    $(window).scroll(function () {
        var scroll = $(window).scrollTop();
        if (scroll > 0) {
            $('.navbar-transparent').addClass('shrink');
        }
        if (scroll <= 0) {
            $('.navbar-transparent').removeClass('shrink');
        }
    });

//smooth scroll
    $(function () {
        $('.scroll-to a[href*="#"]:not([href="#"])').click(function () {
            if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') && location.hostname == this.hostname) {
                var target = $(this.hash);
                target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
                if (target.length) {
                    $('html, body').animate({
                        scrollTop: target.offset().top
                    }, 1000);
                    return false;
                }
            }
        });
    });



//Auto Close Responsive Navbar on Click
    function close_toggle() {
        if ($(window).width() <= 768) {
            $('.navbar-collapse a').on('click', function () {
                $('.navbar-collapse').collapse('hide');
            });
        }
        else {
            $('.navbar .navbar-default a').off('click');
        }
    }
    close_toggle();
    $(window).resize(close_toggle);

    //hero text fade flexslider
    $(window).load(function () {
        $('.flexslider').flexslider({
            controlNav: false,
            directionNav: false,
            slideshowSpeed: 4000
        });
    });

    //home slider
    $(window).load(function () {
        $('.main-slider').flexslider({
            controlNav: false,
            directionNav: true,
            slideshowSpeed: 4000,
            prevText: "<i class='ion-chevron-left'></i>",
            nextText: "<i class='ion-chevron-right'></i>"
        });
    });

    //testimonials
    $(window).load(function () {
        $('.testi-slider').flexslider({
            controlNav: false,
            directionNav: false,
            slideshowSpeed: 4000
        });
    });

    //back to top
    //Check to see if the window is top if not then display button
    $(window).scroll(function () {
        if ($(this).scrollTop() > 300) {
            $('.scrollToTop').fadeIn();
        } else {
            $('.scrollToTop').fadeOut();
        }
    });

    //Click event to scroll to top
    $('.scrollToTop').click(function () {
        $('html, body').animate({scrollTop: 0}, 800);
        return false;
    });
});

