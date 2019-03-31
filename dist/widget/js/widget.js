(function( $ ) {
    $.fn.feedback = function() {
        var css_link = $("<link>", {
            rel: "stylesheet",
            type: "text/css",
            href: "css/widget.css"
        });
        css_link.appendTo('head');

        var $contMin = $("<div id='feedbackmin'/>");
        var $contFull = $("<div id='feedbackfull'/>");
        var $contFullHead = $("<div class='feedbackfull-header'/>");
        var $contFullBody = $("<div class='feedbackfull-body'/>");
        var $contImgClose = $("<div class='feedbackfull-close'/>");

        var $bChat = $("<div class='feedbackfull-chatarea'/>").append("<div id='chatarea'><ul></ul></div>");
        //var $bDesc = $("<div class='feedbackfull-b-desc'/>").append("<span>Оставьте свое сообщение в этой форме, мы получим его на e-mail и обязательно ответим!</span>");
        var $bInput = $("<div class='feedbackfull-b-input'/>").append("<textarea type='textarea' placeholder='Your message*' data-gramm='false'/>");
        var $bSend = $("<div class='feedbackfull-b-send'/>").append("<span>Send</span>");
        $contFullBody.append($bChat).append($bInput).append($bSend);
        $contFull.append($contFullHead).append($contFullBody);
        $contFullHead.prepend($contImgClose);
        $(this).append($contMin);
        $(this).append($contFull);
        $contFull.hide();
        $contMin.append($("<span class='feedbackmin-text'>Send a message</span>"));
        $contMin.on("click", function (event) {
            $contMin.hide();
            $contFull.show();
        });
        $contImgClose.on("click", function (event) {
            $contMin.show();
            $contFull.hide();

        });
        //localStorage.getItem("sitepower_id")
        var spId = localStorage.getItem("sitepower_id");
        if (!spId) {
            $.get('/api/prospect/c4ca4238a0b923820dcc509a6f75849b').done(function (data) {
                console.log("data.sitepower_id = " + data.sitepower_id);
                localStorage.setItem("sitepower_id", data.sitepower_id);
                localStorage.setItem("sitepower_recepient_id", data.recepient_id);
                connect(data.sitepower_id);
            });
        } else {
            console.log("Already done");
            connect(spId);
        }
        function connect(token) {
            var socket = io('/?sitepower_id='+token);
            $(".feedbackfull-b-send").on("click", function(event){
                var msg = {};
                msg.body = $(".feedbackfull-b-input textarea").val();
                msg.recepient_id = localStorage.getItem("sitepower_recepient_id");
                msg.sender_id = localStorage.getItem("sitepower_id");
                msg.direction = "to_user";
                socket.emit("send", msg);
                $(".feedbackfull-b-input textarea").val("");

            });
            socket.on("receive", function(msg){
                console.log("receive");
                var $msg = $("<li class='message'>" + msg.body + "</li>");
                if (msg.direction == "to_user") {
                    $msg.addClass("to_user")
                } else {
                    $msg.addClass("from_user")
                }

                $(".feedbackfull-chatarea ul").append($msg);
            });
        }





    };
    $("#feedback").feedback();
})(jQuery);
