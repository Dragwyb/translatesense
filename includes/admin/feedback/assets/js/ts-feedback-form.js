(function ($) {
    'use strict';

    class TS_Feedback_Form {

        constructor() {

            this.data = window.tsFeedbackData || {};

            this.pluginSlug = this.data.plugin_slug || '';

            this.mainWrapper = $(
                '.ts-deactivate-feedback-form-wrapper[data-slug="' +
                this.pluginSlug +
                '"]'
            );

            this.deactivateButton = $(
                '#the-list tr[data-slug="' +
                this.pluginSlug +
                '"] span.deactivate a'
            );

            this.deactivateLink =
                this.deactivateButton.attr('href') || '';

            this.form = this.mainWrapper.find(
                '.ts-feedback-form'
            );

            this.reasonInputs = this.form.find(
                'input[name="reason"]'
            );

            this.messageSection = this.form.find(
                '.ts-message-section'
            );

            this.messageField = this.form.find(
                '#ts-feedback-message'
            );

            this.characterCurrent = this.form.find(
                '.ts-character-current'
            );

            this.shareDiagnostics = this.form.find(
                '#ts-share-diagnostics'
            );

            this.submitButton = this.form.find(
                '.ts-button-feedback'
            );

            this.skipButton = this.form.find(
                '.ts-button-skip'
            );

            this.closeButton = this.mainWrapper.find(
                '.ts-deactivate-close'
            );

            this.emptyFieldMessage = this.form.find(
                '#ts-empty-field-msg'
            );

            this.init();
        }

        /**
         * Initialize.
         */
        init() {

            if (!this.mainWrapper.length) {
                return;
            }

            this.deactivateButtonHandler();
            this.closeButtonHandler();
            this.reasonHandler();
            this.messageHandler();
            this.submitButtonHandler();
            this.skipButtonHandler();
            this.keyboardHandler();
        }

        /**
         * Intercept plugin deactivate button.
         */
        deactivateButtonHandler() {

            if (!this.deactivateButton.length) {
                return;
            }

            this.deactivateButton.on(
                'click',
                this.showFeedbackForm.bind(this)
            );
        }

        /**
         * Show feedback modal.
         */
        showFeedbackForm(event) {

            event.preventDefault();

            this.mainWrapper.removeClass(
                'ts-form-hide'
            );

            $('body').addClass(
                'ts-feedback-open'
            );

            this.reasonInputs.first().trigger(
                'focus'
            );
        }

        /**
         * Close button.
         */
        closeButtonHandler() {

            this.closeButton.on(
                'click',
                () => {
                    this.closeFeedbackForm();
                }
            );
        }

        /**
         * Close feedback form.
         */
        closeFeedbackForm() {

            this.mainWrapper.addClass(
                'ts-form-hide'
            );

            $('body').removeClass(
                'ts-feedback-open'
            );
        }

        /**
         * Reason selection.
         */
        reasonHandler() {

            this.reasonInputs.on(
                'change',
                (event) => {

                    const $input =
                        $(event.currentTarget);

                    const placeholder =
                        $input.data('placeholder') || '';

                    this.reasonInputs
                        .closest('.ts-reason')
                        .removeClass('is-selected');

                    $input
                        .closest('.ts-reason')
                        .addClass('is-selected');

                    this.messageField.attr(
                        'placeholder',
                        placeholder ||
                        'Tell us more about your experience...'
                    );

                    /*
                     * Temporary disablement does not
                     * require additional information.
                     */
                    if (
                        $input.val() ===
                        'temporary_plugin_pause'
                    ) {

                        this.messageSection.attr(
                            'hidden',
                            true
                        );

                        this.messageField.val('');

                        this.updateCharacterCount();

                        return;
                    }

                    this.messageSection.removeAttr(
                        'hidden'
                    );

                    this.hideValidationError();

                    this.messageField.trigger(
                        'focus'
                    );
                }
            );
        }

        /**
         * Message character count.
         */
        messageHandler() {

            this.messageField.on(
                'input',
                () => {
                    this.updateCharacterCount();
                }
            );
        }

        /**
         * Update character count.
         */
        updateCharacterCount() {

            const length =
                this.messageField.val().length;

            this.characterCurrent.text(
                length
            );
        }

        /**
         * Submit form.
         */
        submitButtonHandler() {

            this.form.on(
                'submit',
                (event) => {

                    event.preventDefault();

                    this.submitFeedbackForm();
                }
            );
        }

        /**
         * Skip feedback.
         */
        skipButtonHandler() {

            this.skipButton.on(
                'click',
                (event) => {

                    event.preventDefault();

                    if (this.deactivateLink) {
                        window.location.href =
                            this.deactivateLink;
                    }
                }
            );
        }

        /**
         * Submit feedback.
         */
        submitFeedbackForm() {

            const reason = this.form
                .find(
                    'input[name="reason"]:checked'
                )
                .val();

            const message = this.messageField
                .val()
                .trim();

            const nonce = this.form
                .find(
                    'input[name="ts_send_feedback_nonce"]'
                )
                .val();

            const shareDiagnostics =
                this.shareDiagnostics.is(':checked');

            if (!reason) {

                this.showValidationError();

                return;
            }

            this.hideValidationError();

            const data = {

                action: 'ts_send_feedback',

                reason: reason,

                message: message,

                share_diagnostics:
                    shareDiagnostics ? '1' : '0',

                nonce: nonce
            };

            this.setLoading(true);

            this.sendFeedback(data);
        }

        /**
         * Send AJAX request.
         */
        sendFeedback(data) {

            $.ajax({

                type: 'POST',

                url: this.data.ajax_url,

                data: data,

                dataType: 'json',

                timeout: 20000,

                success: (response) => {

                    if (
                        response &&
                        response.success
                    ) {

                        this.setLoading(false);

                        if (this.deactivateLink) {

                            window.location.href =
                                this.deactivateLink;
                        }

                        return;
                    }

                    this.setLoading(false);

                    const message =
                        response &&
                            response.data &&
                            response.data.message
                            ? response.data.message
                            : 'Unable to send feedback. Please try again.';

                    this.showAjaxError(
                        message
                    );
                },

                error: (xhr) => {

                    this.setLoading(false);

                    let message =
                        'Unable to send feedback. Please try again.';

                    if (
                        xhr.responseJSON &&
                        xhr.responseJSON.data &&
                        xhr.responseJSON.data.message
                    ) {

                        message =
                            xhr.responseJSON.data.message;
                    }

                    this.showAjaxError(
                        message
                    );
                }
            });
        }

        /**
         * Loading state.
         */
        setLoading(isLoading) {

            this.submitButton.toggleClass(
                'is-loading',
                isLoading
            );

            this.submitButton.prop(
                'disabled',
                isLoading
            );
        }

        /**
         * Show validation error.
         */
        showValidationError() {

            this.emptyFieldMessage
                .stop(true, true)
                .fadeIn(150);

            this.form
                .find('.ts-reasons')
                .addClass(
                    'ts-has-error'
                );

            setTimeout(
                () => {

                    this.form
                        .find('.ts-reasons')
                        .removeClass(
                            'ts-has-error'
                        );

                    this.emptyFieldMessage
                        .fadeOut(200);

                },
                3500
            );
        }

        /**
         * Hide validation error.
         */
        hideValidationError() {

            this.emptyFieldMessage.hide();

            this.form
                .find('.ts-reasons')
                .removeClass(
                    'ts-has-error'
                );
        }

        /**
         * AJAX error.
         */
        showAjaxError(message) {

            if (!message) {

                message =
                    'Unable to send feedback. Please try again.';
            }

            this.emptyFieldMessage
                .text(message)
                .stop(true, true)
                .fadeIn(150);

            setTimeout(
                () => {

                    this.emptyFieldMessage
                        .fadeOut(200);

                },
                5000
            );
        }

        /**
         * Escape key.
         */
        keyboardHandler() {

            $(document).on(
                'keydown.tsFeedback',
                (event) => {

                    if (
                        event.key === 'Escape' &&
                        !this.mainWrapper.hasClass(
                            'ts-form-hide'
                        )
                    ) {

                        this.closeFeedbackForm();
                    }
                }
            );
        }
    }

    /**
     * Initialize.
     */
    $(document).ready(
        () => {
            new TS_Feedback_Form();
        }
    );

})(jQuery);