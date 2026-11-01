<?php

/**
 * Feedback_Form class.
 *
 * Handles plugin deactivation feedback.
 */

namespace TranslateSense\Includes\Admin\Feedback;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Feedback_Form' ) ) {

	/**
	 * Feedback_Form class.
	 */
	class Feedback_Form {

		/**
		 * Single instance.
		 *
		 * @var self|null
		 */
		private static $instance = null;

		/**
		 * Feedback API route.
		 *
		 * @var string
		 */
		private $route;

		/**
		 * Plugin name.
		 *
		 * @var string
		 */
		private $plugin_name;

		/**
		 * Plugin slug.
		 *
		 * @var string
		 */
		private $plugin_slug;

		/**
		 * Plugin version.
		 *
		 * @var string
		 */
		private $plugin_version;

		/**
		 * Get instance.
		 *
		 * @return self
		 */
		public static function get_instance() {

			if ( ! isset( self::$instance ) ) {
				self::$instance = new self();
			}

			return self::$instance;
		}

		/**
		 * Constructor.
		 */
		public function __construct() {

			$this->route = esc_url( 'https://feedback.dragwyb.com/wp-json/wpfd/v1/feedback' );

			$this->plugin_name = 'TranslateSense';

			$this->plugin_slug = 'translatesense';

			$this->plugin_version = defined( 'TRANSLATESENSE_VERSION' ) ? TRANSLATESENSE_VERSION : '1.0.0';

			add_action( 'wp_ajax_ts_send_feedback', array( $this, 'ts_send_feedback' ) );

			add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_styles_and_scripts' ) );

			add_action( 'admin_head', array( $this, 'display_plugin_installed_form' ) );
		}

		/**
		 * Display feedback form on Plugins screen.
		 *
		 * @return void
		 */
		public function display_plugin_installed_form() {

			$screen = get_current_screen();

			if (
				! $screen ||
				'plugins' !== $screen->id ||
				! current_user_can( 'manage_options' )
			) {
				return;
			}

			$deactivation_options = array(

				'plugin_performance_issues'     => array(
					'title'             => __(
						'Technical difficulties with the plugin',
						'translatesense'
					),
					'input_placeholder' => __(
						'Please describe the technical issues you encountered.',
						'translatesense'
					),
				),

				'alternative_plugin_discovered' => array(
					'title'             => __(
						'Switched to another plugin',
						'translatesense'
					),
					'input_placeholder' => __(
						'Which plugin are you using instead?',
						'translatesense'
					),
				),

				'configuration_challenges'      => array(
					'title'             => __(
						'Difficulty with plugin configuration',
						'translatesense'
					),
					'input_placeholder' => __(
						'What configuration issue did you experience?',
						'translatesense'
					),
				),

				'temporary_plugin_pause'        => array(
					'title'             => __(
						'Temporarily disabling the plugin',
						'translatesense'
					),
					'input_placeholder' => '',
				),

				'other_reasons'                 => array(
					'title'             => __(
						'Other reason',
						'translatesense'
					),
					'input_placeholder' => __(
						'Please tell us why you are deactivating the plugin.',
						'translatesense'
					),
				),
			);
			?>

			<div
				class="ts-deactivate-feedback-form-wrapper ts-form-hide"
				data-slug="<?php echo esc_attr( $this->plugin_slug ); ?>"
			>

				<div class="ts-deactivate-feedback-form">

					<div class="ts-feedback-header">

						<div class="ts-feedback-header-content">

							<h2>
								<?php
								echo esc_html__(
									'Help us improve',
									'translatesense'
								);
								?>
							</h2>

							<p>
								<?php
								echo esc_html__(
									'Why are you deactivating this plugin?',
									'translatesense'
								);
								?>
							</p>

						</div>

						<button
							type="button"
							class="ts-deactivate-close"
							aria-label="<?php echo esc_attr__( 'Close feedback form', 'translatesense' ); ?>"
						>
							<span class="dashicons dashicons-no-alt"></span>
						</button>

					</div>

					<form
						method="post"
						class="ts-feedback-form"
					>

						<?php
						wp_nonce_field(
							'ts_send_feedback_nonce',
							'ts_send_feedback_nonce'
						);
						?>

						<div class="ts-feedback-body">

							<div
								id="ts-empty-field-msg"
								class="ts-message"
								role="alert"
								aria-live="polite"
							>
								<?php
								echo esc_html__(
									'Please select a reason before submitting your feedback.',
									'translatesense'
								);
								?>
							</div>

							<div class="ts-section-label">
								<?php
								echo esc_html__(
									'Select a reason',
									'translatesense'
								);
								?>
							</div>

							<div class="ts-reasons">

								<?php foreach ( $deactivation_options as $key => $option ) : ?>

									<label class="ts-reason">

										<input
											type="radio"
											name="reason"
											value="<?php echo esc_attr( $key ); ?>"
											data-placeholder="<?php echo esc_attr( $option['input_placeholder'] ); ?>"
										/>

										<span
											class="ts-radio-ui"
											aria-hidden="true"
										></span>

										<span class="ts-reason-label">
											<?php echo esc_html( $option['title'] ); ?>
										</span>

									</label>

								<?php endforeach; ?>

							</div>

							<div
								class="ts-message-section"
								hidden
							>

								<div class="ts-section-label">
									<?php
									echo esc_html__(
										'Tell us more',
										'translatesense'
									);
									?>

									<span class="ts-optional">
										<?php
										echo esc_html__(
											'(Optional)',
											'translatesense'
										);
										?>
									</span>
								</div>

								<textarea
									id="ts-feedback-message"
									name="message"
									rows="3"
									maxlength="1000"
									placeholder="<?php echo esc_attr__( 'Tell us more about your experience...', 'translatesense' ); ?>"
								></textarea>

								<div class="ts-character-count">
									<span class="ts-character-current">0</span>/1000
								</div>

							</div>

							<div class="ts-diagnostics">

								<label
									class="ts-diagnostics-label"
									for="ts-share-diagnostics"
								>

									<input
										type="checkbox"
										id="ts-share-diagnostics"
										name="share_diagnostics"
										value="1"
									/>

									<span
										class="ts-checkbox-ui"
										aria-hidden="true"
									></span>

									<span class="ts-diagnostics-content">

										<strong>
											<?php
											echo esc_html__(
												'Share technical details for debugging',
												'translatesense'
											);
											?>

											<span class="ts-optional">
												<?php
												echo esc_html__(
													'(Optional)',
													'translatesense'
												);
												?>
											</span>
										</strong>

										<small>
											<?php
											echo esc_html__(
												'If enabled, we may collect your admin email, site URL, plugin version, WordPress version, and PHP version to help diagnose issues.',
												'translatesense'
											);
											?>

											<a
												href="<?php echo esc_url( 'https://dragwyb.com/privacy-policy/' ); ?>"
												target="_blank"
												rel="noopener noreferrer"
											>
												<?php
												echo esc_html__(
													'Read more',
													'translatesense'
												);
												?>
											</a>
										</small>

									</span>

								</label>

							</div>

						</div>

						<div class="ts-feedback-footer">

							<button
								type="button"
								class="button ts-button-skip"
							>
								<?php
								echo esc_html__(
									'Skip & Deactivate',
									'translatesense'
								);
								?>
							</button>

							<button
								type="submit"
								class="button button-primary ts-button-feedback"
							>

								<span class="ts-button-text">
									<?php
									echo esc_html__(
										'Submit Feedback',
										'translatesense'
									);
									?>
								</span>

								<span
									class="ts-button-spinner"
									aria-hidden="true"
								></span>

							</button>

						</div>

					</form>

				</div>

			</div>

			<?php
		}

		/**
		 * Enqueue assets.
		 *
		 * @return void
		 */
		public function enqueue_styles_and_scripts() {

			$screen = get_current_screen();

			if (
				! $screen ||
				'plugins' !== $screen->id ||
				! current_user_can( 'manage_options' )
			) {
				return;
			}

			wp_enqueue_style(
				'ts-deactivate-styles',
				plugin_dir_url( __FILE__ ) . 'assets/css/ts-feedback-form.min.css',
				array(),
				$this->plugin_version
			);

			wp_enqueue_script(
				'ts-deactivate-scripts',
				plugin_dir_url( __FILE__ ) . 'assets/js/ts-feedback-form.min.js',
				array( 'jquery' ),
				$this->plugin_version,
				true
			);

			wp_localize_script(
				'ts-deactivate-scripts',
				'tsFeedbackData',
				array(
					'ajax_url'    => admin_url( 'admin-ajax.php' ),
					'plugin_slug' => $this->plugin_slug,
				)
			);
		}

		/**
		 * Process feedback.
		 *
		 * @return void
		 */
		public function ts_send_feedback() {

			if ( ! current_user_can( 'manage_options' ) ) {

				wp_send_json_error(
					array(
						'message' => __(
							'You do not have permission to submit feedback.',
							'translatesense'
						),
					),
					403
				);
			}

			check_ajax_referer(
				'ts_send_feedback_nonce',
				'nonce'
			);

			$allowed_reasons = array(
				'plugin_performance_issues',
				'alternative_plugin_discovered',
				'configuration_challenges',
				'temporary_plugin_pause',
				'other_reasons',
			);

			$reason = isset( $_POST['reason'] )
				? sanitize_key( wp_unslash( $_POST['reason'] ) )
				: '';

			if ( ! in_array( $reason, $allowed_reasons, true ) ) {

				wp_send_json_error(
					array(
						'message' => __(
							'Please select a valid feedback reason.',
							'translatesense'
						),
					),
					400
				);
			}

			$message = isset( $_POST['message'] )
				? sanitize_textarea_field(
					wp_unslash( $_POST['message'] )
				)
				: '';

			/*
			 * Optional technical-details consent.
			 *
			 * Only collect technical/site information when
			 * the user explicitly enables this option.
			 */
			$share_diagnostics = isset( $_POST['share_diagnostics'] )
				&& '1' === sanitize_text_field(
					wp_unslash( $_POST['share_diagnostics'] )
				);

			/*
			 * Always send basic feedback information.
			 */
			$this->feedback_data = array(
				'plugin_name'     => sanitize_text_field( $this->plugin_name ),
				'plugin_slug'     => sanitize_text_field( $this->plugin_slug ),
				'plugin_version'  => sanitize_text_field( $this->plugin_version ),
				'deactive_reason' => $reason,
				'message'         => $message,
			);

			/*
			 * Only send technical/site information when
			 * the user explicitly checks the optional checkbox.
			 */
			if ( $share_diagnostics ) {

				$this->feedback_data['email'] = sanitize_email(
					get_option( 'admin_email' )
				);

				$this->feedback_data['website_url'] = esc_url_raw(
					home_url()
				);

				$this->feedback_data['plugin_version'] = sanitize_text_field(
					$this->plugin_version
				);

				$this->feedback_data['wp_version'] = sanitize_text_field(
					get_bloginfo( 'version' )
				);

				$this->feedback_data['php_version'] = sanitize_text_field(
					PHP_VERSION
				);
			}

			$response = wp_remote_post(
				$this->route,
				array(
					'timeout' => 15,
					'body'    => $this->feedback_data,
					'headers' => array(
						'Accept' => 'application/json',
					),
				)
			);

			if ( is_wp_error( $response ) ) {

				wp_send_json_error(
					array(
						'message' => __(
							'Unable to send feedback. Please try again.',
							'translatesense'
						),
					),
					500
				);
			}

			$status_code = wp_remote_retrieve_response_code( $response );

			if (
				$status_code < 200 ||
				$status_code >= 300
			) {

				wp_send_json_error(
					array(
						'message' => __(
							'The feedback server could not process your request.',
							'translatesense'
						),
					),
					500
				);
			}

			wp_send_json_success(
				array(
					'message' => __(
						'Thank you for your feedback.',
						'translatesense'
					),
				)
			);
		}
	}
}
