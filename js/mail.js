/* global Handlebars, relative_modified_date, formatDate, humanFileSize */
var Mail = {
	State:{
		currentFolderId:null,
		currentAccountId:null,
		currentMessageId:null
	},
	UI:{
		initializeInterface:function () {
			Handlebars.registerHelper("colorOfDate", function(dateInt) {
				var lastModified = new Date(dateInt*1000);
				var lastModifiedTime = Math.round(lastModified.getTime() / 1000);

				// date column
				var modifiedColor = Math.round((Math.round((new Date()).getTime() / 1000)-lastModifiedTime)/60/60/24*5);
				if (modifiedColor > 200) {
					modifiedColor = 200;
				}
				return 'rgb('+modifiedColor+','+modifiedColor+','+modifiedColor+')';
			});

			Handlebars.registerHelper("relativeModifiedDate", function(dateInt) {
				var lastModified = new Date(dateInt*1000);
				var lastModifiedTime = Math.round(lastModified.getTime() / 1000);
				return relative_modified_date(lastModifiedTime);
			});

			Handlebars.registerHelper("formatDate", function(dateInt) {
				var lastModified = new Date(dateInt*1000);
				return formatDate(lastModified);
			});

			Handlebars.registerHelper("humanFileSize", function(size) {
				return humanFileSize(size);
			});

			$.ajax(OC.generateUrl('apps/mail/accounts'), {
				data:{},
				type:'GET',
				success:function (jsondata) {
						// don't try to load accounts if there are none
						if(jsondata.length === 0) {
							return;
						}
						var source   = $("#mail-account-manager").html();
						var template = Handlebars.compile(source);
						var html = template(jsondata);
						$('#accountManager').html(html);
						Mail.UI.loadFoldersForAccount(jsondata[0].accountId);
					}
			});
		},

		loadFoldersForAccount : function(accountId) {
			var firstFolder, folderId;

			Mail.UI.clearFolders();
			Mail.UI.clearMessages();
			$('#app-navigation').addClass('icon-loading');
			$('#app-content').addClass('icon-loading');

			$.ajax(OC.generateUrl('apps/mail/accounts/{accountId}/folders', {accountId: accountId}), {
				data:{},
				type:'GET',
				success:function (jsondata) {
					var source   = $("#mail-folder-template").html();
					var template = Handlebars.compile(source);
					var html = template(jsondata);

					$('#app-navigation').removeClass('icon-loading');
					$('#folders').html(html);

					firstFolder = $('#app-navigation').find('.mail_folders li');

					if (firstFolder.length > 0) {
						$('#app-navigation').fadeIn(800);
						firstFolder = firstFolder.first();
						folderId = firstFolder.data('folder_id');
						accountId = firstFolder.parent().data('account_id');

						Mail.UI.loadMessages(accountId, folderId);

						// Save current folder
						Mail.UI.setFolderActive(accountId, folderId);
						Mail.State.currentAccountId = accountId;
						Mail.State.currentFolderId = folderId;
					} else {
						$('#app-navigation').fadeOut(800);
					}
				}
			});
		},

		clearMessages:function () {
			var table = $('#mail_messages');

			table.empty();
			$('#messages-loading').fadeIn();
		},

		clearFolders:function () {
			var list = $('.mail_folders');

			list.empty();
		},

		hideMenu:function () {
			var menu = $('#new-message');

			menu.addClass('hidden');
		},

		addMessages:function (data) {
			var source   = $("#mail-messages-template").html();
			var template = Handlebars.compile(source);
			var html = template(data);
			$('#mail_messages').append(html);

			_.each($('.avatar'), function(a) {
				$(a).imageplaceholder($(a).data('user'), $(a).data('user'));
			}
			);
		},

		loadMessages:function (accountId, folderId) {
			// Set folder active
			Mail.UI.setFolderInactive(Mail.State.currentAccountId, Mail.State.currentFolderId);
			Mail.UI.setFolderActive(accountId, folderId);
			Mail.UI.clearMessages();

			$('#mail_new_message').fadeIn();
			$('#app-content').addClass('icon-loading');

			$.ajax(
				OC.generateUrl('apps/mail/accounts/{accountId}/folders/{folderId}/messages',
					{'accountId':accountId, 'folderId':encodeURIComponent(folderId)}), {
					data: {},
					type:'GET',
					success: function (jsondata) {
						// Add messages
						Mail.UI.addMessages(jsondata);
						$('#app-content').removeClass('icon-loading');

						Mail.State.currentAccountId = accountId;
						Mail.State.currentFolderId = folderId;
						Mail.State.currentMessageId = null;
					},
					error: function() {

						// Set the old folder as being active
						Mail.UI.setFolderInactive(accountId, folderId);
						Mail.UI.setFolderActive(Mail.State.currentAccountId, Mail.State.currentFolderId);

//						OC.dialogs.alert(jsondata.data.message, t('mail', 'Error'));
					}
				});
		},

		deleteMessage:function (messageId) {
			$.ajax(
				OC.generateUrl('apps/mail/accounts/{accountId}/folders/{folderId}/messages/{messageId}',
					{
					accountId: Mail.State.currentAccountId,
					folderId: encodeURIComponent(Mail.State.currentFolderId),
					messageId: messageId
				}), {
					data: {},
					type:'DELETE',
					success: function () {
						var summaryRow = $('#mail-message-summary-' + messageId);
						summaryRow.find('.mail_message_loading').fadeOut(function(){
							summaryRow.remove();
						});

						// Set current Message as active
						Mail.State.currentMessageId = null;
					},
					error: function() {
						OC.Notification.show(t('mail', 'Error while deleting mail.'));
					}
				});
		},

		saveAttachment: function(messageId, attachmentId) {
			OC.dialogs.filepicker(
				t('mail', 'Choose a folder to store the attachment in'),
				function (path) {
					// Loading feedback
					$('.attachment-save-to-cloud')
						.removeClass('icon-upload')
						.addClass('icon-loading-small')
						.html(t('mail', 'Saving to Files …'))
						.prop('disabled', true);

					$.ajax(
						OC.generateUrl(
							'apps/mail/accounts/{accountId}/folders/{folderId}/messages/{messageId}/attachment/{attachmentId}',
						{
							accountId: Mail.State.currentAccountId,
							folderId: encodeURIComponent(Mail.State.currentFolderId),
							messageId: messageId,
							attachmentId: attachmentId
						}), {
							data: {
								targetPath: path
							},
							type:'POST',
							success: function () {
								if (typeof attachmentId === "undefined") {
									OC.Notification.show(t('mail', 'Attachments saved to Files.'));
								} else {
									OC.Notification.show(t('mail', 'Attachment saved to Files.'));
								}
							},
							error: function() {
								if (typeof attachmentId === "undefined") {
									OC.Notification.show(t('mail', 'Error while saving attachments to Files.'));
								} else {
									OC.Notification.show(t('mail', 'Error while saving attachment to Files.'));
								}
							},
							complete: function() {
								// Remove loading feedback again
								$('.attachment-save-to-cloud')
									.removeClass('icon-loading-small')
									.addClass('icon-upload')
									.html(t('mail', 'Save to Files'))
									.prop('disabled', false);
							}
						});
				},
				false,
				'httpd/unix-directory',
				true
			);
		},

		openMessage:function (messageId) {
			// close email first
			// Check if message is open
			if (Mail.State.currentMessageId !== null) {
				var currentOpenMessage = $('#mail-message-summary-' + Mail.State.currentMessageId);
				currentOpenMessage.find('.mail_message').slideUp(function(){
					currentOpenMessage.find('.mail_message').html('');
					var nextOpenMessage = $('#mail-message-summary-' + messageId);
					nextOpenMessage[0].scrollIntoView(true);
				});
				var lastMessageId = Mail.State.currentMessageId;
				Mail.State.currentMessageId = null;
				if (lastMessageId === messageId) {
					return;
				}
			}

			var summaryRow = $('#mail-message-summary-' + messageId);
			summaryRow.find('.mail_message_loading').slideDown();

			$.ajax(
				OC.generateUrl('apps/mail/accounts/{accountId}/folders/{folderId}/messages/{messageId}',
					{
					accountId: Mail.State.currentAccountId,
					folderId: encodeURIComponent(Mail.State.currentFolderId),
					messageId: messageId
				}), {
					data: {},
					type:'GET',
					success: function (data) {
						// Render the message body
						var source   = $("#mail-message-template").html();
						var template = Handlebars.compile(source);
						var html = template(data);
						summaryRow.find('.mail_message_loading').fadeOut(function(){
							var mailBody = summaryRow.find('.mail_message');
							mailBody.html(html);
							mailBody.slideDown();
							mailBody.parent().removeClass('unseen');

							// HTML mail rendering
							$('iframe').load(function() {
								// Expand height to not have two scrollbars
								$(this).height( $(this).contents().find('html').height() + 20);
								// Fix styling
								$(this).contents().find('body').css({
									'margin': '0',
									'font-weight': 'normal',
									'font-size': '.8em',
									'line-height': '1.6em',
									'font-family': "'Open Sans', Frutiger, Calibri, 'Myriad Pro', Myriad, sans-serif",
									'color': '#000'
								});
								// Fix font when different font is forced
								$(this).contents().find('font').prop({
									'face': 'Open Sans',
									'color': '#000'
								});
								$(this).contents().find('.moz-text-flowed').css({
									'font-family': 'inherit',
									'font-size': 'inherit'
								});
								// Expand height again after rendering to account for new size
								$(this).height( $(this).contents().find('html').height() + 20);
							});

						});

						// Set current Message as active
						Mail.State.currentMessageId = messageId;
					},
					error: function() {
						OC.dialogs.alert(t('mail', 'Error while loading mail message.'), t('mail', 'Error'));
					}
				});
		},

		setFolderActive:function (accountId, folderId) {
			$('.mail_folders[data-account_id="' + accountId + '"]>li[data-folder_id="' + folderId + '"]')
				.addClass('active');
		},

		addAccount:function () {
			$('#mail_messages').addClass('hidden');

			Mail.UI.clearFolders();
			Mail.UI.hideMenu();

			var menu = $('#mail-setup');
			menu.removeClass('hidden');
			// don't show New Message button on Add account screen
			$('#mail_new_message').hide();
		},

		setFolderInactive:function (accountId, folderId) {
			$('.mail_folders[data-account_id="' + accountId + '"]>li[data-folder_id="' + folderId + '"]')
				.removeClass('active');
		},

		bindEndlessScrolling:function () {
			// Add handler for endless scrolling
			//   (using jquery.endless-scroll.js)
			$('#app-content').endlessScroll({
				fireDelay:10,
				fireOnce:false,
				loader:OC.imagePath('core', 'loading.gif'),
				callback:function (i) {
					var from, newLength;

					// Only do the work if we show a folder
					if (Mail.State.currentAccountId !== null && Mail.State.currentFolderId !== null) {

						// do not work if we already hit the end
						if ($('#mail_messages').data('stop_loading') !== 'true') {
							from = $('#mail_messages .mail_message_summary').length - 1;
							// minus 1 because of the template

							// decrease if a message is shown
							if (Mail.State.currentMessageId !== null) {
								from = from - 1;
							}

							$.ajax(
								OC.generateUrl('apps/mail/accounts/{accountId}/folders/{folderId}/messages?from={from}&to={to}',
									{
									'accountId':Mail.State.currentAccountId,
									'folderId':encodeURIComponent(Mail.State.currentFolderId),
									from: from,
									to: from+20
								}), {
									type:'GET',
									success:function (jsondata) {
										Mail.UI.addMessages(jsondata.data);

										// If we did not get any new messages stop
										newLength = $('#mail_messages .mail_message_summary').length - 1;
										// minus 1 because of the template
										if (from === newLength || ( from === newLength + 1 &&
											Mail.State.currentMessageId !== null )) {
											$('#mail_messages').data('stop_loading', 'true');
										}
									}
								});
						}
					}
				}
			});
		},

		unbindEndlessScrolling:function () {
			$('#app-content').unbind('scroll');
		}
	}
};

$(document).ready(function () {
	Mail.UI.initializeInterface();

	// auto detect button handling
	$('#auto_detect_account').click(function (event) {
		event.preventDefault();
		$('#mail-address').prop('disabled', true);
		$('#mail-password').prop('disabled', true);
		$('#auto_detect_account').prop('disabled', true);
		$('#auto_detect_account').val(t('mail', 'Connecting …'));
		$('#connect-loading').fadeIn();
		var emailAddress, password;
		emailAddress = $('#mail-address').val();
		password = $('#mail-password').val();
		$.ajax(OC.generateUrl('apps/mail/accounts'), {
			data:{
				emailAddress : emailAddress,
				password : password,
				autoDetect : true
			},
			type:'POST',
			success:function () {
				// reload on success
				window.location.reload();
			},
			error: function(jqXHR, textStatus, errorThrown){
				var error = errorThrown || textStatus || t('mail', 'Unknown error');
				OC.dialogs.alert(error, t('mail', 'Server Error'));
			},
			complete: function() {
				$('#mail-address').prop('disabled', false);
				$('#mail-password').prop('disabled', false);
				$('#auto_detect_account').prop('disabled', false);
				$('#auto_detect_account').val(t('mail', 'Connect'));
				$('#connect-loading').fadeOut();
			}
		});
	});

	// new mail message button handling
	$(document).on('click', '#mail_new_message', function () {
		$('#to').val('');
		$('#subject').val('');
		$('#new-message-body').val('');

		$('#mail_new_message').hide();
		$('#new-message').slideDown();
		$('#to').focus();
	});

	// Clicking on a folder loads the message list
	$(document).on('click', 'ul.mail_folders li', function () {
		var accountId = $(this).parent().data('account_id');
		var folderId = $(this).data('folder_id');

		Mail.UI.loadMessages(accountId, folderId);
	});

	// Clicking on a message loads the entire message
	$(document).on('click', '#mail_messages .mail-message-header', function () {
		var messageId = $(this).parent().data('messageId');
		Mail.UI.openMessage(messageId);
	});

	$(document).on('click', '#mail_messages .action.delete', function(event) {
		event.stopPropagation();
		$(this).removeClass('icon-delete').addClass('icon-loading');
		var messageElement = $(this).parent().parent();
		messageElement.addClass('transparency');
		messageElement.slideUp();
		var messageId = messageElement.data('messageId');
		Mail.UI.deleteMessage(messageId);
	});

	$(document).on('click', '#mail_messages .attachment-save-to-cloud', function(event) {
		event.stopPropagation();
		var messageId = $(this).parent().parent().parent().parent().parent().parent().data('messageId');
		var attachmentId = $(this).parent().data('attachmentId');
		Mail.UI.saveAttachment(messageId, attachmentId);
	});

	$(document).on('click', '#mail_messages .attachments-save-to-cloud', function(event) {
		event.stopPropagation();
		var messageId = $(this).parent().parent().parent().parent().parent().data('messageId');
		Mail.UI.saveAttachment(messageId);
	});

	$(document).on('change', '#app-navigation .mail_account', function(event) {
		event.stopPropagation();

		var accountId;

		accountId = $( this ).val();
		if(accountId === 'addAccount') {
			Mail.UI.addAccount();
		} else {
			Mail.UI.loadFoldersForAccount(accountId);
		}
	});

	Mail.UI.bindEndlessScrolling();

	$('textarea').autosize();
});
