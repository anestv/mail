<?php
 /**
 * ownCloud - Mail app
 *
 * @author Jakob Sack
 * @copyright 2015 Jakob Sack jakob@owncloud.org
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this library.  If not, see <http://www.gnu.org/licenses/>.
 *
 */


namespace OCA\Mail\Service\HtmlPurify;
use HTMLPurifier_AttrTransform;
use HTMLPurifier_Config;
use HTMLPurifier_Context;
use OCP\IURLGenerator;
use OCP\Util;

/**
 * Adds copies src to data-src on all img tags.
 */
class TransformCSSBackground extends HTMLPurifier_AttrTransform {
	/** @var IURLGenerator */
	private $urlGenerator;

	public function __construct(IURLGenerator $urlGenerator) {
		$this->urlGenerator = $urlGenerator;
	}

	/**
	 * @param array $attr
	 * @param HTMLPurifier_Config $config
	 * @param HTMLPurifier_Context $context
	 * @return array
	 */
	public function transform($attr, $config, $context) {
		if (!isset($attr['style']) ||
			strpos($attr['style'], 'background') === false) {
			return $attr;
		}

		// Check if there is a background image given
		$cssAttributes = explode(';', $attr['style']);

		$func = function($cssAttribute) {
			if (preg_match('/\S/', $cssAttribute) === 0) {
				// empty or whitespace
				return '';
			}

			list($name, $value) = explode(':', $cssAttribute, 2);
			if(strpos($name, 'background') !== false &&
				strpos($value, 'url(') !== false) {
				// Replace image URL
				$value = preg_replace('/url\("?http.*\)/i',
					'url('.Util::imagePath('mail', 'blocked-image.png').')',
					$value);
				return $name.':'.$value;
			} else {
				return $cssAttribute;
			}
		};

		// Reassemble style
		$cssAttributes = array_map($func, $cssAttributes);
		$newStyle = implode(';', $cssAttributes);

		// Replace style if required
		if ($newStyle !== $attr['style']) {
			$attr['data-original-style'] = $attr['style'];
			$attr['style'] = $newStyle;
		}

		return $attr;
	}
}
