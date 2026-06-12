# Example supply-chain policy for ossrisk.
#
# Usage:
#   ossrisk . --policy examples/policies/supply-chain.rego
#
# The scan result JSON (same shape as `ossrisk --format json`) is provided as
# `input`. Every message added to `deny` is reported as a policy violation and
# makes ossrisk exit 1.
#
# These rules show cross-signal conditions that a single --fail-on threshold
# can't express.

package ossrisk

import rego.v1

# No critical CVEs, anywhere in the tree.
deny contains msg if {
	some dep in input.results
	some sig in dep.signals
	sig.type == "cve"
	sig.severity == "critical"
	msg := sprintf("%s@%s has critical %s: %s", [dep.name, dep.version, sig.id, sig.summary])
}

# No suspected typosquats.
deny contains msg if {
	some dep in input.results
	some sig in dep.signals
	sig.type == "typosquat"
	msg := sprintf("%s@%s may typosquat %s (%s)", [dep.name, dep.version, sig.suspectedTarget, sig.reason])
}

# Strong copyleft is only blocked for direct dependencies; transitives are
# tolerated.
deny contains msg if {
	some dep in input.results
	dep.isDirect
	some sig in dep.signals
	sig.type == "license"
	sig.category == "strong-copyleft"
	msg := sprintf("%s@%s is %s (strong copyleft) and a direct dependency", [dep.name, dep.version, sig.license])
}

# Install scripts combined with a brand-new publisher is the classic
# event-stream takeover pattern — block it even though neither signal alone
# would reach the --fail-on threshold.
deny contains msg if {
	some dep in input.results
	some script_sig in dep.signals
	script_sig.type == "install-script"
	some maint_sig in dep.signals
	maint_sig.type == "maintainer"
	maint_sig.pattern == "new-publisher"
	msg := sprintf("%s@%s runs install scripts (%s) and was recently published by a new maintainer", [dep.name, dep.version, concat(", ", script_sig.hooks)])
}
