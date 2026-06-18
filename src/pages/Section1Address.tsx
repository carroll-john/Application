import { useApplication } from "../context/ApplicationContext";
import {
  AddressSectionCards,
  renderStructuredAddressMeta,
  Section1StepPage,
  useSection1AddressForm,
} from "../features/section1";

export default function Section1Address() {
  const { data, updateContactDetails } = useApplication();
  const {
    applyResolvedAddress,
    formData,
    postalLookup,
    residentialLookup,
    setPostalDifferent,
    unavailableLookupMessage,
    updateManualAddress,
    updateUnitNumber,
    useAddressSearch,
  } = useSection1AddressForm(data.contactDetails);

  const persist = () => updateContactDetails(formData);

  const renderAddressMeta = (address: Parameters<typeof renderStructuredAddressMeta>[0]) => {
    const meta = renderStructuredAddressMeta(address);
    return meta ? <p className="mt-2 text-xs text-slate-500">{meta}</p> : null;
  };

  return (
    <Section1StepPage step="address" persist={persist}>
      <AddressSectionCards
        formData={formData}
        onApplyResolvedAddress={applyResolvedAddress}
        onManualAddressChange={updateManualAddress}
        onPostalDifferentChange={setPostalDifferent}
        onUnitNumberChange={updateUnitNumber}
        postalLookup={postalLookup}
        renderAddressMeta={renderAddressMeta}
        residentialLookup={residentialLookup}
        unavailableLookupMessage={unavailableLookupMessage}
        useAddressSearch={useAddressSearch}
      />
    </Section1StepPage>
  );
}
