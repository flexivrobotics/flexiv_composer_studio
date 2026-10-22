<template>
	<div class="tab-content">
		<section class="info-section">
			<h4 class="info-section__title">{{ $t('info.system.manipulator') }}</h4>
			<div class="info-row">
				<span class="info-label">{{ $t('info.label.name') }}</span>
				<span class="info-value">{{ selection.item!.data.manipulator.name || '—' }}</span>
			</div>
			<div class="info-row">
				<span class="info-label">{{ $t('info.system.label.serialNo') }}</span>
				<span class="info-value">{{ selection.item!.data.manipulator.publicSerialNumber || selection.item!.data.manipulator.serialNumber || '—' }}</span>
			</div>
			<div class="info-row">
				<span class="info-label">{{ $t('info.label.dof') }}</span>
				<span class="info-value">{{ selection.item!.data.manipulator.dof ?? '—' }}</span>
			</div>
		</section>

		<section v-if="selection.item!.data.externalAxis" class="info-section">
			<h4 class="info-section__title">{{ $t('info.system.externalAxis') }}</h4>
			<div class="info-row">
				<span class="info-label">{{ $t('info.label.name') }}</span>
				<span class="info-value">{{ selection.item!.data.externalAxis.name }}</span>
			</div>
			<div class="info-row">
				<span class="info-label">{{ $t('info.label.dof') }}</span>
				<span class="info-value">{{ selection.item!.data.externalAxis.dof }}</span>
			</div>
		</section>

		<section class="info-section">
			<h4 class="info-section__title">{{ $t('info.system.manipulatorJointLimits') }}</h4>
			<table v-if="manipulatorLimits.length > 0" class="limits-table">
				<thead>
					<tr>
						<th>{{ $t('info.system.tableHeader.joint') }}</th>
						<th>{{ $t('info.system.tableHeader.lowerLimit') }}</th>
						<th>{{ $t('info.system.tableHeader.upperLimit') }}</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="(row, i) in manipulatorLimits" :key="'m' + i">
						<td class="limits-joint">Joint {{ i + 1 }}</td>
						<td>{{ formatDeg(row.lower) }}</td>
						<td>{{ formatDeg(row.upper) }}</td>
					</tr>
				</tbody>
			</table>
			<p v-else class="info-none">{{ $t('info.emptyState.noManipulatorLimits') }}</p>
		</section>

		<section v-if="externalAxisLimits.length > 0" class="info-section">
			<h4 class="info-section__title">{{ $t('info.system.externalAxisJointLimits') }}</h4>
			<table class="limits-table">
				<thead>
					<tr>
						<th>{{ $t('info.system.tableHeader.joint') }}</th>
						<th>{{ $t('info.system.tableHeader.lower') }}</th>
						<th>{{ $t('info.system.tableHeader.upper') }}</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="(row, i) in externalAxisLimits" :key="'e' + i">
						<td class="limits-joint">{{ $t('info.system.jointIndex', { index: i + 1 }) }}</td>
						<td>{{ formatLimit(row.lower, row.prismatic) }}</td>
						<td>{{ formatLimit(row.upper, row.prismatic) }}</td>
					</tr>
				</tbody>
			</table>
		</section>
	</div>
</template>

<script setup lang="ts">
// ── SystemInfoPanel ────────────────────────────────────────────────
// Read-only specification view for the selected system: manipulator /
// external-axis details and joint limits. Rendered as the "Information"
// tab of SystemDetailPanel (which owns the tab strip); this component no
// longer carries its own tabs or operations.

import { computed } from 'vue';
import { useSelection } from '../../composables/useSelection';
import { radToDeg, formatJoint } from '../../utils/math';

// ── Composables ────────────────────────────────────────────────────

const selection = useSelection();

// ── Math Helpers ───────────────────────────────────────────────────

function formatDeg(v: number): string {
	return (v != null && !isNaN(v)) ? radToDeg(v).toFixed(2) : '—';
}

/** An external-axis limit with its unit: degrees, or metres if prismatic. */
function formatLimit(v: number, prismatic: boolean): string {
	return (v != null && !isNaN(v)) ? formatJoint(v, prismatic) : '—';
}

// ── Computed ───────────────────────────────────────────────────────

const manipulatorLimits = computed(() => {
	const manip = selection.item?.data?.manipulator;
	if (!manip) return [];
	const lower = manip.lowerLimit as number[] | undefined;
	const upper = manip.upperLimit as number[] | undefined;
	if (!lower || !upper) return [];
	const count = Math.min(lower.length, upper.length);
	const rows: { lower: number; upper: number }[] = [];
	for (let i = 0; i < count; i++) {
		rows.push({ lower: lower[i], upper: upper[i] });
	}
	return rows;
});

const externalAxisLimits = computed(() => {
	const ea = selection.item?.data?.externalAxis;
	if (!ea) return [];
	const lower = ea.lowerLimit as number[] | undefined;
	const upper = ea.upperLimit as number[] | undefined;
	if (!lower || !upper) return [];
	const count = Math.min(lower.length, upper.length);
	// External-axis joints come first in the system's joint-name list.
	const names = selection.jointNames ?? [];
	const rows: { lower: number; upper: number; prismatic: boolean }[] = [];
	for (let i = 0; i < count; i++) {
		const prismatic = selection.prismaticJointNames?.includes(names[i]) ?? false;
		rows.push({ lower: lower[i], upper: upper[i], prismatic });
	}
	return rows;
});
</script>
