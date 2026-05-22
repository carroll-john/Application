import { ApplicationShell } from "../components/ApplicationShell";
import { useApplication } from "../context/ApplicationContext";
import {
  AddressSectionCards,
  renderStructuredAddressMeta,
  useSection1AddressForm,
} from "../features/section1";
import { useSection1Step } from "../hooks/useSection1Step";

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
    useGoogleAddressSearch,
  } = useSection1AddressForm(data.contactDetails);

  const persist = () => updateContactDetails(formData);
  const { shellProps, step } = useSection1Step({
    step: "address",
    persist,
  });

  const renderAddressMeta = (address: Parameters<typeof renderStructuredAddressMeta>[0]) => {
    const meta = renderStructuredAddressMeta(address);
    return meta ? <p className="mt-2 text-xs text-slate-500">{meta}</p> : null;
  };

  return (
    <ApplicationShell
      sectionLabel={step.sectionLabel}
      progress={step.progress}
      title={step.title}
      description={step.description}
      {...shellProps}
    >
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
        useGoogleAddressSearch={useGoogleAddressSearch}
      />
    </ApplicationShell>
  );
}
