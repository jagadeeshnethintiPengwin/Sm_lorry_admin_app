import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';

import {
  vehicleRequestService,
  type AdminVehicleRequestDetail,
} from '@services/fleet.service';
import { useApi } from '@hooks/useApi';
import { openExternalUrl } from '@utils/openExternalUrl';

import { AppHeader, Card, Content, Icon, ListState, Screen } from '@components/index';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { IconName } from '@components/common/Icon';
import type { RootStackParamList } from '@navigation/types';

/**
 * One vehicle request, read in full — the same record the web panel shows.
 *
 * Grouped the way the decision is made rather than as a flat list of fields:
 * route, load, timing, people, paperwork. An operator reads this before
 * quoting, so it answers "what are they actually asking for" in one screen.
 *
 * Sender, receiver and documents come from the booking the request became,
 * because that is where they exist — a request is an enquiry, and the customer
 * has not been asked for consignee details or papers yet. On an unconfirmed one
 * the app says so rather than showing blanks, which read as data that failed to
 * load instead of data that does not exist.
 */

type Rt = RouteProp<RootStackParamList, 'VehicleRequestDetails'>;

function stamp(iso?: string | null): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
}

const Line: React.FC<{ label: string; value?: unknown }> = ({ label, value }) => {
  const text =
    value === null || value === undefined || value === '' ? null : String(value);
  if (!text) {
    return null;
  }
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{text}</Text>
    </View>
  );
};

const Block: React.FC<{
  icon: IconName;
  title: string;
  children: React.ReactNode;
}> = ({ icon, title, children }) => (
  <Card style={styles.block}>
    <View style={styles.blockHead}>
      <Icon name={icon} size={13} color={palette.red} />
      <Text style={styles.blockTitle}>{title}</Text>
    </View>
    {children}
  </Card>
);

export const VehicleRequestDetailsScreen: React.FC = () => {
  const { params } = useRoute<Rt>();
  const { data, loading, error, refetch } = useApi<AdminVehicleRequestDetail>(
    () => vehicleRequestService.get(params.requestId),
    [params.requestId],
  );

  const booking = (data?.booking ?? null) as Record<string, unknown> | null;
  const papers = data?.documents ?? [];

  return (
    <Screen>
      <AppHeader title="Vehicle Request" subtitle={data?.status ?? ''} showBack />
      <Content>
        <ListState
          loading={loading}
          error={error}
          empty={false}
          what="this request"
          onRetry={refetch}
        />

        {data ? (
          <>
            <Card style={styles.block}>
              <Text style={styles.company}>
                {data.company ?? data.contactName ?? 'Customer'}
              </Text>
              <Text style={styles.raised}>
                Raised {stamp(data.createdAt)}
                {data.bookingReference ? ` · booked as #${data.bookingReference}` : ''}
              </Text>
            </Card>

            <Block icon="map-pin" title="Route">
              <Line label="Pickup" value={data.pickupPlace} />
              <Line label="Pickup address" value={booking?.pickupAddress} />
              <Line label="Drop" value={data.dropPlace} />
              <Line label="Drop address" value={booking?.dropAddress} />
              <Line
                label="Distance"
                value={booking?.distanceKm != null ? `${booking.distanceKm} km` : null}
              />
            </Block>

            <Block icon="package-search" title="Cargo">
              <Line label="Vehicle asked for" value={data.vehicleType} />
              <Line label="Material" value={data.material} />
              <Line
                label="Weight"
                value={data.weightTons != null ? `${data.weightTons} Ton` : null}
              />
              <Line label="Packaging" value={booking?.packageType} />
              <Line label="Units" value={booking?.units} />
            </Block>

            <Block icon="calendar-days" title="Schedule">
              <Line label="Needed" value={data.neededAt ? stamp(data.neededAt) : null} />
              <Line
                label="Pickup at"
                value={booking?.pickupAt ? stamp(String(booking.pickupAt)) : null}
              />
              <Line label="Time slot" value={booking?.timeSlot} />
              <Line
                label="Expected"
                value={booking?.expectedAt ? stamp(String(booking.expectedAt)) : null}
              />
            </Block>

            <Block icon="user" title="Sender and receiver">
              {booking ? (
                <>
                  <Line label="Sender" value={booking.senderName} />
                  <Line label="Sender phone" value={booking.senderPhone} />
                  <Line label="Receiver" value={booking.receiverName} />
                  <Line label="Receiver phone" value={booking.receiverPhone} />
                </>
              ) : (
                <Text style={styles.note}>
                  Collected when the request becomes a booking — the customer has
                  not been asked for consignee details yet.
                </Text>
              )}
              <View style={styles.divider} />
              <Line label="Customer" value={data.company ?? data.contactName} />
              <Line label="Contact" value={data.contactName} />
              <Line label="Mobile" value={data.customerMobile ?? data.mobile} />
              <Line label="Email" value={data.customerEmail} />
              <Line label="Address" value={data.customerAddress} />
            </Block>

            <Block icon="file-text" title="Documents">
              {papers.length === 0 ? (
                <Text style={styles.note}>
                  {booking
                    ? 'No papers on this booking yet.'
                    : 'Papers are attached once the request becomes a booking.'}
                </Text>
              ) : (
                papers.map((d, i) => {
                  const url = d.fileUrl ? String(d.fileUrl) : null;
                  return (
                    <Pressable
                      key={String(d.id ?? i)}
                      disabled={!url}
                      onPress={() => (url ? openExternalUrl(url) : undefined)}
                      style={styles.paper}
                    >
                      <Text style={styles.paperName} numberOfLines={1}>
                        {String(d.name ?? 'Document')}
                      </Text>
                      <Text style={styles.paperKind}>{String(d.kind ?? '')}</Text>
                      {url ? (
                        <Icon name="chevron-right" size={13} color={palette.navy} />
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </Block>

            {data.note ? (
              <Block icon="package-search" title="Customer's note">
                <Text style={styles.noteBody}>{data.note}</Text>
              </Block>
            ) : null}
          </>
        ) : null}
      </Content>
    </Screen>
  );
};

const styles = StyleSheet.create({
  block: { marginBottom: s(10) },
  blockHead: { flexDirection: 'row', alignItems: 'center', marginBottom: s(6) },
  blockTitle: {
    marginLeft: s(5),
    ...font(9, '800', { color: palette.red, letterSpacing: 0.6 }),
  },
  company: font(15, '800', { color: palette.navy }),
  raised: font(10, '600', { color: palette.slate500 }),
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: s(2),
  },
  lineLabel: font(10, '600', { color: palette.slate500 }),
  lineValue: {
    flex: 1,
    marginLeft: s(10),
    textAlign: 'right',
    ...font(11, '700', { color: palette.navy }),
  },
  note: font(10, '600', { color: palette.slate500 }),
  noteBody: font(11, '600', { color: palette.navy }),
  divider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: s(6),
  },
  paper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(5),
    borderRadius: radius.sm,
  },
  paperName: { flex: 1, ...font(11, '700', { color: palette.navy }) },
  paperKind: {
    marginHorizontal: s(6),
    ...font(9, '700', { color: palette.slate500 }),
  },
});
